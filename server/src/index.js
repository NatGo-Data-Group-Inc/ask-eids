import { assertSingleRegionOperation, getRuntimeDiagnostics } from './config/runtime.js';
import { buildApp } from './app.js';

try {
  assertSingleRegionOperation();
} catch (error) {
  if (process.env.EIDS_ALLOW_NON_GOVCLOUD_FOR_DEV === 'true' && process.env.NODE_ENV !== 'production') {
    console.warn(`[dev-only bypass] ${error.message} (NODE_ENV=${process.env.NODE_ENV || 'development'}, EIDS_ALLOW_NON_GOVCLOUD_FOR_DEV=true)`);
  } else {
    throw error;
  }
}

const port = Number(process.env.PORT || 3000);
const app = await buildApp({ withVite: true });
const diagnostics = getRuntimeDiagnostics();

app.listen(port, () => {
  console.log(`AskEIDS running at http://127.0.0.1:${port}`);
  console.log(`AskEIDS runtime region=${diagnostics.awsRegion} storage=${diagnostics.storageMode} envSources=${diagnostics.envSources.length}`);
});
