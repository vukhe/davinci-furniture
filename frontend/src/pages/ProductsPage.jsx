
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { fetchCategories, fetchProducts } from '../store/slices/productSlice';
import { productAPI } from '../services/api';
import ProductCard from '../components/product/ProductCard';
import SemanticSearchBar from '../components/ai/SemanticSearchBar';
import { Button, EmptyState, SectionTitle, Spinner } from '../components/common';

const PAGE_SIZE = 12;
const BACKEND = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

const SORT_OPTIONS = [
  { value: 'created_at:DESC', label: 'Mới nhất' },
  { value: 'price:ASC', label: 'Giá tăng dần' },
  { value: 'price:DESC', label: 'Giá giảm dần' },
  { value: 'sold:DESC', label: 'Bán chạy' },
  { value: 'name:ASC', label: 'Tên A-Z' },
];

const getVisiblePages = (currentPage, totalPages) => {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);

  if (currentPage <= 3) return [1, 2, 3, 4, totalPages];
  if (currentPage >= totalPages - 2) return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];

  return [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
};

const ProductsPage = () => {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { list, categories, pagination, loading } = useSelector((s) => s.product);

  const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
  const category = searchParams.get('category') || '';
  const search = searchParams.get('search') || '';
  const semantic = searchParams.get('semantic') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const featured = searchParams.get('featured') || '';
  const sort = searchParams.get('sort') || 'created_at';
  const order = searchParams.get('order') || 'DESC';

  const [searchInput, setSearchInput] = useState(search);
  const [semanticResults, setSemanticResults] = useState([]);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticError, setSemanticError] = useState('');
  const [semanticQueryLabel, setSemanticQueryLabel] = useState('');

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (!categories.length) dispatch(fetchCategories());
  }, [categories.length, dispatch]);

  useEffect(() => {
    if (semantic) return;
    dispatch(fetchProducts({
      page,
      limit: PAGE_SIZE,
      ...(category ? { category } : {}),
      ...(search ? { search } : {}),
      ...(minPrice ? { minPrice } : {}),
      ...(maxPrice ? { maxPrice } : {}),
      ...(featured ? { featured } : {}),
      sort,
      order,
    }));
  }, [dispatch, page, category, search, semantic, minPrice, maxPrice, featured, sort, order]);

  useEffect(() => {
    if (!semantic) {
      setSemanticResults([]);
      setSemanticError('');
      setSemanticQueryLabel('');
      return undefined;
    }

    let cancelled = false;

    const loadSemanticResults = async () => {
      setSemanticLoading(true);
      setSemanticError('');

      try {
        const semanticUrl = new URL(`${BACKEND}/api/ai-proxy/search`, window.location.origin);
        semanticUrl.searchParams.set('q', semantic);
        semanticUrl.searchParams.set('limit', '24');
        if (category) semanticUrl.searchParams.set('category', category);

        const semanticRes = await fetch(semanticUrl.toString());
        if (!semanticRes.ok) throw new Error('semantic-search-failed');

        const semanticData = await semanticRes.json();
        const aiItems = semanticData.results || [];
        const productIds = aiItems.map((item) => item.product_id);
        const scoreMap = Object.fromEntries(
          aiItems.map((item) => [
            String(item.product_id),
            Number(item.business_score ?? item.semantic_score ?? item.score ?? 0),
          ])
        );

        if (!productIds.length) {
          if (!cancelled) {
            setSemanticResults([]);
            setSemanticQueryLabel(semanticData.query || semantic);
          }
          return;
        }

        const productData = await productAPI.getAll({
          ids: productIds.join(','),
          limit: productIds.length,
        });
        const products = productData.data || [];

        const orderedProducts = productIds
          .map((id) => products.find((product) => String(product.id) === String(id)))
          .filter(Boolean)
          .map((product) => ({
            ...product,
            semantic_score: scoreMap[String(product.id)] || 0,
          }));

        if (!cancelled) {
          setSemanticResults(orderedProducts);
          setSemanticQueryLabel(semanticData.query || semantic);
        }
      } catch (error) {
        if (!cancelled) {
          setSemanticResults([]);
          setSemanticError('Không thể tải kết quả tìm kiếm AI. Vui lòng thử lại.');
          setSemanticQueryLabel(semantic);
        }
      } finally {
        if (!cancelled) setSemanticLoading(false);
      }
    };

    loadSemanticResults();

    return () => {
      cancelled = true;
    };
  }, [semantic, category]);

  const topLevelCategories = useMemo(
    () => categories.filter((item) => item.parent_id === null),
    [categories]
  );

  const visiblePages = useMemo(
    () => getVisiblePages(page, pagination.pages || 1),
    [page, pagination.pages]
  );

  const semanticDisplayList = useMemo(() => {
    let items = [...semanticResults];

    if (minPrice) {
      items = items.filter((product) => Number(product.sale_price || product.price || 0) >= Number(minPrice));
    }
    if (maxPrice) {
      items = items.filter((product) => Number(product.sale_price || product.price || 0) <= Number(maxPrice));
    }
    if (featured === 'true') {
      items = items.filter((product) => Boolean(product.is_featured));
    }

    if (sort === 'price') {
      items.sort((left, right) => {
        const leftPrice = Number(left.sale_price || left.price || 0);
        const rightPrice = Number(right.sale_price || right.price || 0);
        return order === 'ASC' ? leftPrice - rightPrice : rightPrice - leftPrice;
      });
    } else if (sort === 'sold') {
      items.sort((left, right) => {
        const leftSold = Number(left.sold || 0);
        const rightSold = Number(right.sold || 0);
        return order === 'ASC' ? leftSold - rightSold : rightSold - leftSold;
      });
    } else if (sort === 'name') {
      items.sort((left, right) => {
        const result = String(left.name || '').localeCompare(String(right.name || ''), 'vi');
        return order === 'ASC' ? result : -result;
      });
    }

    return items;
  }, [semanticResults, minPrice, maxPrice, featured, sort, order]);

  const displayList = semantic ? semanticDisplayList : list;
  const displayLoading = semantic ? semanticLoading : loading;
  const displayTotal = semantic ? semanticDisplayList.length : (pagination.total || 0);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value === '' || value === null || value === undefined) next.delete(key);
    else next.set(key, value);
    if (key === 'search') next.delete('semantic');
    if (key !== 'page') next.set('page', '1');
    setSearchParams(next);
  };

  const handleSortChange = (value) => {
    const [nextSort, nextOrder] = value.split(':');
    const next = new URLSearchParams(searchParams);
    next.set('sort', nextSort);
    next.set('order', nextOrder);
    next.set('page', '1');
    setSearchParams(next);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setParam('search', searchInput.trim());
  };

  const handleReset = () => {
    setSearchInput('');
    setSearchParams({});
  };

  const clearSemanticSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('semantic');
    next.set('page', '1');
    setSearchParams(next);
  };

  return (
    <div className="bg-stone-50 min-h-screen">
      <section className="bg-dark text-white">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <SectionTitle
            label="Catalog"
            title="Khám phá nội thất DaVinci"
            subtitle="Lọc theo danh mục, mức giá và từ khóa để tìm đúng sản phẩm bạn cần."
          />
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 md:py-12">
        <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-8">
          <aside className="bg-white border border-gray-200 rounded-sm p-5 h-fit space-y-5">
            <div>
              <p className="text-sm font-semibold text-dark mb-3">Tìm kiếm</p>
              <form onSubmit={handleSearchSubmit} className="space-y-3">
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Tên sản phẩm..."
                  className="w-full border border-gray-200 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-primary-500"
                />
                <Button type="submit" className="w-full">
                  Tìm sản phẩm
                </Button>
              </form>
            </div>

            <div>
              <label className="text-sm font-semibold text-dark mb-3 block">Danh mục</label>
              <select
                value={category}
                onChange={(e) => setParam('category', e.target.value)}
                className="w-full border border-gray-200 rounded-sm px-4 py-3 text-sm bg-white focus:outline-none focus:border-primary-500"
              >
                <option value="">Tất cả danh mục</option>
                {topLevelCategories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-sm font-semibold text-dark mb-3">Khoảng giá</p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min="0"
                  value={minPrice}
                  onChange={(e) => setParam('minPrice', e.target.value)}
                  placeholder="Từ"
                  className="w-full border border-gray-200 rounded-sm px-3 py-3 text-sm focus:outline-none focus:border-primary-500"
                />
                <input
                  type="number"
                  min="0"
                  value={maxPrice}
                  onChange={(e) => setParam('maxPrice', e.target.value)}
                  placeholder="Đến"
                  className="w-full border border-gray-200 rounded-sm px-3 py-3 text-sm focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 border border-gray-200 rounded-sm px-4 py-3 text-sm cursor-pointer">
              <span className="text-dark font-medium">Chỉ hiện nổi bật</span>
              <input
                type="checkbox"
                checked={featured === 'true'}
                onChange={(e) => setParam('featured', e.target.checked ? 'true' : '')}
                className="w-4 h-4 accent-primary-500"
              />
            </label>

            <button
              type="button"
              onClick={handleReset}
              className="w-full border border-gray-200 hover:border-dark text-dark text-sm font-medium px-4 py-3 rounded-sm transition-colors"
            >
              Xóa bộ lọc
            </button>
          </aside>

          <div className="space-y-6">
            <div className="rounded-[24px] border border-amber-200 bg-[linear-gradient(135deg,_#fff8eb_0%,_#fffdf8_100%)] p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
                    <span className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[10px] tracking-[0.22em]">AI Search</span>
                    Tìm kiếm ngữ nghĩa
                  </p>
                  <p className="mt-2 text-sm text-stone-600">
                    Mô tả nhu cầu tự nhiên như “ghế gỗ phong cách Bắc Âu cho phòng nhỏ” để AI gợi ý sản phẩm phù hợp.
                  </p>
                </div>
                {semantic ? (
                  <button
                    type="button"
                    onClick={clearSemanticSearch}
                    className="text-sm font-medium text-amber-700 hover:text-amber-800"
                  >
                    Tắt tìm kiếm AI
                  </button>
                ) : null}
              </div>
              <div className="mt-4">
                <SemanticSearchBar initialQuery={semantic} />
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="font-heading text-2xl text-dark">Tất cả sản phẩm</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {displayTotal} sản phẩm
                </p>
                {semantic ? (
                  <p className="mt-1 text-xs text-amber-700">
                    Kết quả AI cho "{semanticQueryLabel || semantic}"
                  </p>
                ) : null}
                {semanticError ? (
                  <p className="mt-1 text-xs text-red-500">{semanticError}</p>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 whitespace-nowrap">Sắp xếp</span>
                <select
                  value={`${sort}:${order}`}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="border border-gray-200 rounded-sm px-4 py-3 text-sm bg-white focus:outline-none focus:border-primary-500"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {displayLoading ? (
              <div className="bg-white border border-gray-200 rounded-sm py-20 flex items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : displayList.length > 0 ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                  {displayList.map((product, index) => (
                    <ProductCard key={product.id} product={product} index={index} />
                  ))}
                </div>

                {!semantic ? (
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setParam('page', String(Math.max(1, page - 1)))}
                      disabled={page <= 1}
                      className="px-4 py-2 border border-gray-200 rounded-sm text-sm text-dark disabled:opacity-40 disabled:cursor-not-allowed hover:border-dark transition-colors"
                    >
                      Trước
                    </button>

                    {visiblePages.map((pageNumber, index) => {
                      const previousPage = visiblePages[index - 1];
                      const showGap = previousPage && pageNumber - previousPage > 1;

                      return (
                        <div key={pageNumber} className="contents">
                          {showGap && <span className="px-2 text-gray-400">...</span>}
                          <button
                            type="button"
                            onClick={() => setParam('page', String(pageNumber))}
                            className={`min-w-10 px-3 py-2 rounded-sm text-sm border transition-colors ${
                              pageNumber === page
                                ? 'bg-dark text-white border-dark'
                                : 'bg-white text-dark border-gray-200 hover:border-dark'
                            }`}
                          >
                            {pageNumber}
                          </button>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => setParam('page', String(Math.min(pagination.pages || 1, page + 1)))}
                      disabled={page >= (pagination.pages || 1)}
                      className="px-4 py-2 border border-gray-200 rounded-sm text-sm text-dark disabled:opacity-40 disabled:cursor-not-allowed hover:border-dark transition-colors"
                    >
                      Sau
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="bg-white border border-gray-200 rounded-sm">
                <EmptyState
                  icon="🪑"
                  title="Không tìm thấy sản phẩm phù hợp"
                  description={
                    semantic
                      ? 'AI chưa tìm thấy kết quả phù hợp với mô tả hiện tại. Hãy thử mô tả ngắn hơn hoặc tắt tìm kiếm AI.'
                      : 'Hãy thử đổi từ khóa, khoảng giá hoặc danh mục để xem thêm kết quả.'
                  }
                  action={
                    <button
                      type="button"
                      onClick={semantic ? clearSemanticSearch : handleReset}
                      className="inline-flex items-center justify-center px-5 py-3 rounded-sm border border-dark text-dark text-sm font-medium hover:bg-dark hover:text-white transition-colors"
                    >
                      {semantic ? 'Tắt tìm kiếm AI' : 'Đặt lại bộ lọc'}
                    </button>
                  }
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProductsPage;
