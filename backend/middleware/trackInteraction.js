const sql = require('mssql');

const SCORES = { view: 1.0, wishlist: 3.0, purchase: 5.0, rating: 2.0 };

async function logInteraction(pool, userId, productId, type) {
  if (!userId || !productId) return;
  try {
    await pool.request()
      .input('uid',   sql.Int,     userId)
      .input('pid',   sql.Int,     productId)
      .input('type',  sql.VarChar, type)
      .input('score', sql.Float,   SCORES[type] ?? 1.0)
      .query('INSERT INTO UserInteractions (user_id,product_id,type,score,created_at) VALUES (@uid,@pid,@type,@score,GETDATE())');
  } catch (e) {
    console.error('[Track] logInteraction:', e.message);
  }
}

function trackViewMiddleware(pool) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode === 200 && req.user?.id) {
        // slug route: product_id is resolved after controller, skip view tracking by ID
        // only track if :id param is a numeric product id
        const pid = parseInt(req.params.id);
        if (pid) logInteraction(pool, req.user.id, pid, 'view');
      }
    });
    next();
  };
}

const trackWishlist = (pool, uid, pid) => logInteraction(pool, uid, pid, 'wishlist');
const trackRating   = (pool, uid, pid) => logInteraction(pool, uid, pid, 'rating');

async function trackOrderPurchase(pool, userId, productIds) {
  if (!userId || !productIds?.length) return;
  const ids = productIds.filter(Boolean);
  const table = new sql.Table('UserInteractions');
  table.create = false;
  table.columns.add('user_id',    sql.Int,         { nullable: false });
  table.columns.add('product_id', sql.Int,         { nullable: false });
  table.columns.add('type',       sql.VarChar(20), { nullable: false });
  table.columns.add('score',      sql.Float,       { nullable: false });
  table.columns.add('created_at', sql.DateTime,    { nullable: false });
  const now = new Date();
  for (const pid of ids) table.rows.add(userId, pid, 'purchase', SCORES.purchase, now);
  try {
    await pool.request().bulk(table);
  } catch (e) {
    console.error('[Track] trackOrderPurchase:', e.message);
  }
}

async function triggerRetrain(aiUrl) {
  try {
    await fetch(`${aiUrl}/api/ai/recommend/retrain`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error('[Track] triggerRetrain:', e.message);
  }
}

module.exports = { logInteraction, trackViewMiddleware, trackWishlist, trackOrderPurchase, trackRating, triggerRetrain, SCORES };
