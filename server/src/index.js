import { assertSingleRegionOperation, getRuntimeDiagnostics } from './config/runtime.js';
import { buildApp } from './app.js';

assertSingleRegionOperation();

const port = Number(process.env.PORT || 3000);
const app = await buildApp({ withVite: true });
const diagnostics = getRuntimeDiagnostics();

app.listen(port, () => {
  console.log(`AskEIDS running at http://127.0.0.1:${port}`);
  console.log(`AskEIDS runtime region=${diagnostics.awsRegion} storage=${diagnostics.storageMode} envSources=${diagnostics.envSources.length}`);
});
