const cron       = require('node-cron');
const { execFile } = require('child_process');
const path       = require('path');
const express    = require('express');

const AI_URL     = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_DIR     = process.env.AI_SERVICE_DIR || path.join(__dirname, '../../ai-service');
const PYTHON     = process.env.PYTHON_CMD     || 'python';

let retraining = false, reindexing = false, lastRetrain = null, lastReindex = null;

async function triggerRetrainViaApi() {
  if (retraining) return { skipped: true };
  retraining = true;
  setTimeout(() => { retraining = false; }, 10 * 60_000);
  try {
    const res = await fetch(`${AI_URL}/api/ai/recommend/retrain`, {
      method: 'POST', signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) { lastRetrain = new Date().toISOString(); return { success: true, triggered_at: lastRetrain }; }
    return { success: false, error: await res.json().catch(() => ({})) };
  } catch {
    return triggerRetrainDirect();
  }
}

function triggerRetrainDirect() {
  return new Promise(resolve => {
    execFile(PYTHON, ['scripts/train_recommender.py'], { cwd: AI_DIR, timeout: 10 * 60_000 },
      (err, stdout) => {
        retraining = false;
        if (err) return resolve({ success: false, error: err.message });
        lastRetrain = new Date().toISOString();
        console.log('[Scheduler] Direct retrain OK\n' + stdout);
        resolve({ success: true, triggered_at: lastRetrain });
      }
    );
  });
}

function triggerReindex(mode = 'text') {
  return new Promise(resolve => {
    if (reindexing) return resolve({ skipped: true });
    reindexing = true;
    execFile(PYTHON, ['scripts/index_products.py', mode], { cwd: AI_DIR, timeout: 30 * 60_000 },
      (err) => {
        reindexing = false;
        if (err) return resolve({ success: false, error: err.message });
        lastReindex = new Date().toISOString();
        resolve({ success: true, indexed_at: lastReindex });
      }
    );
  });
}

function getStatus() {
  return { retraining, reindexing, last_retrain: lastRetrain, last_reindex: lastReindex };
}

function start() {
  cron.schedule('0 2 * * *',  () => triggerRetrainViaApi(), { timezone: 'Asia/Ho_Chi_Minh' });
  cron.schedule('0 3 * * 0',  () => triggerReindex('text'), { timezone: 'Asia/Ho_Chi_Minh' });
  console.log('[Scheduler] retrain 02:00 | reindex Sunday 03:00 (ICT)');
}

const adminRouter = express.Router();
adminRouter.post('/retrain',  async (req, res) => res.json(await triggerRetrainViaApi()));
adminRouter.post('/reindex',  async (req, res) => res.json(await triggerReindex(req.body?.mode || 'text')));
adminRouter.get('/status',    (_req, res) => res.json(getStatus()));

module.exports = { start, triggerRetrainViaApi, triggerRetrainDirect, triggerReindex, getStatus, adminRouter };
