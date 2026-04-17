import { Fragment, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { apiGet, apiSend, apiUpload } from './lib/api.js';
import {
  buildArtifactTitle,
  getDefaultSourceType,
  getSourceTypeLabel,
  getSourceTypeOptions,
  isBinarySourceType,
  isStructuredImportType,
  isSupportedArtifactFile,
} from '../../shared/artifactTypes.js';

const ToastContext = createContext({ pushToast: () => {} });
const AnnounceContext = createContext({ announce: () => {} });

export default function App() {
  const [toasts, setToasts] = useState([]);
  const [announcement, setAnnouncement] = useState('');
  const supported = useViewportSupported();

  function pushToast(message) {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2600);
  }

  function announce(message) {
    setAnnouncement('');
    window.setTimeout(() => setAnnouncement(message), 10);
  }

  if (!supported) {
    return <UnsupportedViewport />;
  }

  return (
    <AnnounceContext.Provider value={{ announce }}>
      <ToastContext.Provider value={{ pushToast }}>
        <AppShell />
        <ToastRegion toasts={toasts} />
        <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="aria-live-region">{announcement}</div>
      </ToastContext.Provider>
    </AnnounceContext.Provider>
  );
}

function AppShell() {
  return (
    <>
      <TopNav />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/portfolio" replace />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/products/:productId" element={<ProductPage />} />
        </Routes>
      </main>
    </>
  );
}

function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rolePreset = searchParams.get('asRole') || '';
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const { data: session } = useQuery({
    queryKey: ['session', rolePreset],
    queryFn: () => apiGet(withRole('/api/v1/session', rolePreset)),
  });
  const { data: searchResults, isFetching } = useQuery({
    queryKey: ['search', rolePreset, query],
    enabled: query.trim().length >= 2,
    queryFn: () => apiGet(withRole(`/api/v1/search?q=${encodeURIComponent(query)}`, rolePreset)),
  });

  const flatResults = useMemo(() => {
    return (searchResults?.groups || []).flatMap((group) => group.items.map((item) => ({ ...item, type: group.type })));
  }, [searchResults]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, searchResults]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === '/') {
        const targetTag = event.target?.tagName?.toLowerCase();
        if (targetTag !== 'input' && targetTag !== 'textarea') {
          event.preventDefault();
          inputRef.current?.focus();
        }
      }
      if (event.key === 'Escape') {
        setQuery('');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function openResult(item) {
    setQuery('');
    navigate(withRoleRoute(item.route, rolePreset));
  }

  function handleKeyDown(event) {
    if (!flatResults.length) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % flatResults.length);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + flatResults.length) % flatResults.length);
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      openResult(flatResults[activeIndex]);
    }
  }

  return (
    <nav className="topnav">
      <div className="topnav-brand" data-testid="topnav-brand">
        <span className="topnav-logo">EIDS</span>
        <span className="topnav-title">Product Knowledge Hub</span>
      </div>
      <div className="topnav-search" style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          data-testid="topnav-search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          type="text"
          placeholder="Search products, decisions, emails, docs…"
        />
        {query.trim().length >= 2 && (
          <SearchPalette
            query={query}
            isFetching={isFetching}
            results={searchResults?.groups || []}
            activeIndex={activeIndex}
            onOpen={openResult}
          />
        )}
      </div>
      <div className="topnav-user">
        <div className="topnav-avatar">BJ</div>
        <span className="topnav-username">{session?.user?.displayName || 'B. Jennings'}</span>
      </div>
    </nav>
  );
}

function SearchPalette({ query, isFetching, results, activeIndex, onOpen }) {
  const flattened = results.flatMap((group) => group.items);
  return (
    <div className="search-palette" data-testid="search-palette">
      {isFetching && <div className="search-group-title">Searching…</div>}
      {!isFetching && results.length === 0 && <div className="search-group-title">No matching products or sources</div>}
      {results.map((group) => (
        <div key={group.type}>
          <div className="search-group-title">{group.type}</div>
          {group.items.map((item, index) => {
            const absoluteIndex = flattened.findIndex((candidate) => candidate.id === item.id && candidate.route === item.route);
            return (
              <button
                key={`${group.type}-${item.id}-${index}`}
                type="button"
                className={`search-result ${absoluteIndex === activeIndex ? 'active' : ''}`}
                data-testid={group.type === 'products' ? `search-result-product-${item.id}` : `search-result-source-${item.id}`}
                onClick={() => onOpen(item)}
              >
                <span>{item.label}</span>
                <span style={{ color: 'var(--text-300)', fontSize: '0.76rem' }}>{group.type}</span>
              </button>
            );
          })}
        </div>
      ))}
      {query.trim().length < 2 && <div className="search-group-title">Type at least 2 characters</div>}
    </div>
  );
}

function ToastRegion({ toasts }) {
  return (
    <div className="toast-region">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" data-testid="toast-success">{toast.message}</div>
      ))}
    </div>
  );
}

function UnsupportedViewport() {
  return (
    <div className="unsupported-shell" data-testid="unsupported-viewport">
      <div className="unsupported-card">
        <h1>Desktop view required</h1>
        <p style={{ marginTop: 12, color: 'var(--text-500)', lineHeight: 1.6 }}>This V1 experience is only supported at 1024px and above so the portfolio, evidence, and reporting views remain trustworthy.</p>
      </div>
    </div>
  );
}

function useViewportSupported() {
  const [supported, setSupported] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    function onResize() {
      setSupported(window.innerWidth >= 1024);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return supported;
}

function useToasts() {
  return useContext(ToastContext);
}

function useAnnouncements() {
  return useContext(AnnounceContext);
}

function getHarnessParams() {
  const current = new URLSearchParams(window.location.search);
  return {
    rolePreset: current.get('asRole') || '',
    testCase: current.get('testCase') || '',
  };
}

function withRole(path, rolePreset) {
  const url = new URL(path, window.location.origin);
  const harness = getHarnessParams();

  if (rolePreset || harness.rolePreset) {
    url.searchParams.set('asRole', rolePreset || harness.rolePreset);
  }
  if (harness.testCase) {
    url.searchParams.set('testCase', harness.testCase);
  }

  return `${url.pathname}${url.search}`;
}

function withRoleRoute(route, rolePreset) {
  const url = new URL(route, window.location.origin);
  const harness = getHarnessParams();

  if (rolePreset || harness.rolePreset) {
    url.searchParams.set('asRole', rolePreset || harness.rolePreset);
  }
  if (harness.testCase) {
    url.searchParams.set('testCase', harness.testCase);
  }

  return `${url.pathname}${url.search}`;
}

function formatStatusClass(status) {
  return status === 'at-risk' ? 'at-risk' : status;
}

function isSemanticStateDegraded(semanticState) {
  return Boolean(semanticState?.usesLastKnownGood) || ['degraded', 'stale'].includes(semanticState?.freshnessStatus);
}

function formatSemanticFreshnessLabel(semanticState) {
  if (!semanticState) {
    return '';
  }
  const parts = [];
  if (semanticState.freshnessStatus) {
    parts.push(semanticState.freshnessStatus);
  }
  if (semanticState.executionMode) {
    parts.push(semanticState.executionMode);
  }
  return parts.join(' · ');
}

function trustSurfacesEnabled(session) {
  return session?.featureFlags?.enableDentalTrustSurfaces === true;
}

function extractApiErrorCode(error) {
  return error?.error?.code || null;
}

function moveFocusInButtonGroup(event, values, currentValue, selectValue, groupName) {
  const supported = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
  if (!supported.includes(event.key)) {
    return;
  }
  event.preventDefault();

  const currentIndex = values.indexOf(currentValue);
  let nextIndex = currentIndex;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    nextIndex = (currentIndex + 1) % values.length;
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    nextIndex = (currentIndex - 1 + values.length) % values.length;
  } else if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = values.length - 1;
  }

  const nextValue = values[nextIndex];
  selectValue(nextValue);
  const focusSelector = `button[data-roving-group="${groupName}"][data-roving-value="${nextValue}"]`;
  window.requestAnimationFrame(() => {
    const nextButton = document.querySelector(focusSelector);
    nextButton?.focus();
  });
  window.setTimeout(() => {
    const nextButton = document.querySelector(focusSelector);
    nextButton?.focus();
  }, 50);
}

function signalToTimelineFilter(signalType) {
  const supported = new Set(['decision', 'transcript', 'email', 'risk', 'ado', 'weekly', 'document', 'blocker']);
  return supported.has(signalType) ? signalType : 'all';
}
function PortfolioPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const rolePreset = searchParams.get('asRole') || '';
  const quickView = searchParams.get('quickView');
  const { data, isLoading, error } = useQuery({
    queryKey: ['portfolio', rolePreset],
    queryFn: () => apiGet(withRole('/api/v1/portfolio', rolePreset)),
  });
  const { data: quickViewData } = useQuery({
    queryKey: ['quick-view', rolePreset, quickView],
    enabled: Boolean(quickView),
    queryFn: () => apiGet(withRole(`/api/v1/portfolio/quick-view?type=${quickView}`, rolePreset)),
  });

  useEffect(() => {
    const scrollY = sessionStorage.getItem('portfolioScrollY');
    if (scrollY) {
      const target = Number(scrollY);
      window.requestAnimationFrame(() => {
        window.scrollTo(0, target);
      });
      window.setTimeout(() => {
        window.scrollTo(0, target);
        sessionStorage.removeItem('portfolioScrollY');
      }, 0);
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.key]);

  function openProduct(productId) {
    sessionStorage.setItem('portfolioScrollY', String(window.scrollY));
    navigate(withRoleRoute(`/products/${productId}?tab=overview`, rolePreset));
  }

  function setQuickView(type) {
    const next = new URLSearchParams(searchParams);
    next.set('quickView', type);
    setSearchParams(next);
  }

  function closeQuickView() {
    const next = new URLSearchParams(searchParams);
    next.delete('quickView');
    setSearchParams(next);
  }

  if (isLoading) {
    return <div className="page"><div className="empty-panel" data-testid="portfolio-page">Loading portfolio…</div></div>;
  }

  if (error) {
    return <div className="page"><div className="inline-error-panel" data-testid="portfolio-page">We couldn’t load this product. Try again.</div></div>;
  }

  return (
    <div className="page" data-testid="portfolio-page">
      <div className="page-header"><h1>My Portfolio</h1></div>
      <div className="pulse-bar" data-testid="pulse-bar">
        <span className="pulse-stat"><strong>{data.summary.productCount}</strong> products</span>
        <span className="pulse-stat">Avg health: <strong>{data.summary.averageHealth}%</strong></span>
        <span className="pulse-stat"><span className="pulse-dot" style={{ background: 'var(--amber-600)' }}></span><strong>{data.summary.overdueWeeklyCount}</strong> overdue weekly updates</span>
        <span className="pulse-stat"><span className="pulse-dot" style={{ background: 'var(--red-600)' }}></span><strong>{data.summary.needsAttentionCount}</strong> products need attention</span>
        <span className="pulse-stat"><span className="pulse-dot" style={{ background: 'var(--red-600)' }}></span><strong>{data.summary.belowFiftyCount}</strong> below 50% health</span>
      </div>
      <div className="alerts-bar" data-testid="alerts-bar">
        {data.alerts.map((alert) => <span key={alert.id} className="alert-item">{alert.text}</span>)}
      </div>

      <SectionLabel title="Needs Attention" badge={`${data.groups.needsAttention.length} products`} badgeClass="warn" />
      <div className="product-grid">
        {data.groups.needsAttention.map((product) => <ProductCard key={product.id} product={product} onOpen={openProduct} />)}
      </div>

      <SectionLabel title="On Track" badge={`${data.groups.onTrack.length} products`} badgeClass="ok" />
      <div className="product-grid">
        {data.groups.onTrack.map((product) => <ProductCard key={product.id} product={product} onOpen={openProduct} />)}
      </div>

      <div className="quick-views">
        <button className="qv-btn" data-testid="quick-view-risks" onClick={() => setQuickView('risks')}>All Risks</button>
        <button className="qv-btn" data-testid="quick-view-blockers" onClick={() => setQuickView('blockers')}>All Blockers</button>
        <button className="qv-btn" data-testid="quick-view-gaps" onClick={() => setQuickView('gaps')}>Data Gaps</button>
        <button className="qv-btn" data-testid="quick-view-brief-prep" onClick={() => setQuickView('brief-prep')}>Weekly Brief Prep</button>
      </div>

      {quickView && quickViewData ? <QuickViewDrawer payload={quickViewData} onClose={closeQuickView} onOpenProduct={openProduct} /> : null}
    </div>
  );
}

function SectionLabel({ title, badge, badgeClass }) {
  return (
    <div className="section-label">
      <h2>{title}</h2>
      <span className={`section-badge ${badgeClass}`}>{badge}</span>
    </div>
  );
}

function ProductCard({ product, onOpen }) {
  return (
    <button type="button" className="pcard" data-testid={`product-card-${product.id}`} onClick={() => onOpen(product.id)}>
      <div className={`pcard-top ${product.status}`}></div>
      <div className="pcard-body">
        <div className="pcard-header">
          <span className="pcard-name">{product.name}</span>
          <span className={`pcard-status ${product.status}`}>{product.statusLabel}</span>
        </div>
        <div className="pcard-middle">
          <div className="pcard-health-ring">{product.health.overall}%</div>
          <div className="pcard-stats">
            <div>Risks: <strong>{product.counts.risks}</strong> &nbsp; Blockers: <strong>{product.counts.blockers}</strong></div>
            <div>PI {product.pi} · Sprint {product.sprint}</div>
            {product.stakeholders?.length ? <div style={{ fontSize: '.75rem', color: 'var(--text-300)' }}>{product.stakeholders.join(', ')}</div> : null}
          </div>
        </div>
        <div className="pcard-gaps">
          {(product.highlights || []).slice(0, 3).map((gap) => (
            <span key={gap.id} className={`pcard-gap ${gap.level}`}>{gap.level === 'ok' ? '✓' : gap.level === 'miss' ? '✗' : '⚠'} {gap.text}</span>
          ))}
        </div>
        <div className="pcard-footer">
          <span className="pcard-pm">PM: <strong>{product.pm}</strong></span>
          <span className="pcard-link">Open Product →</span>
        </div>
      </div>
    </button>
  );
}

function QuickViewDrawer({ payload, onClose, onOpenProduct }) {
  return (
    <div className="side-overlay" onClick={onClose}>
      <div className="side-panel" data-testid="quick-view-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="report-section-header">
          <h2>{payload.title}</h2>
          <button className="secondary-btn" onClick={onClose}>Close</button>
        </div>
        <div className="source-list" style={{ marginTop: 16 }}>
          {payload.items.map((item) => (
            <button key={item.itemId} type="button" className="source-item" data-testid={`quick-view-item-${item.itemId}`} onClick={() => onOpenProduct(item.productId)}>
              <div className="source-info">
                <div className="source-title">{item.title}</div>
                <div className="source-meta">{item.productName}</div>
              </div>
              <span className={`severity-badge ${item.severity === 'warn' ? 'med' : item.severity}`}>{item.severity}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductPage() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const rolePreset = searchParams.get('asRole') || '';
  const tab = searchParams.get('tab') || 'overview';
  const tabValues = ['overview', 'timeline', 'data', 'sources', 'reports'];
  const [dismissedStatusSourceId, setDismissedStatusSourceId] = useState('');
  const productQuery = useQuery({
    queryKey: ['product', rolePreset, productId],
    queryFn: () => apiGet(withRole(`/api/v1/products/${productId}`, rolePreset)),
    refetchInterval: (query) => (['queued', 'running'].includes(query.state.data?.overview?.latestIngest?.status) ? 800 : false),
    refetchIntervalInBackground: true,
  });
  const sessionQuery = useQuery({
    queryKey: ['session', rolePreset],
    queryFn: () => apiGet(withRole('/api/v1/session', rolePreset)),
  });

  useEffect(() => {
    const latestIngest = productQuery.data?.overview?.latestIngest;
    if (!latestIngest || !['completed', 'partial'].includes(latestIngest.status)) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['sources', rolePreset, productId] });
    queryClient.invalidateQueries({ queryKey: ['data', rolePreset, productId] });
    queryClient.invalidateQueries({ queryKey: ['report', rolePreset, productId] });
  }, [productQuery.data?.overview?.latestIngest?.jobId, productQuery.data?.overview?.latestIngest?.status, productId, queryClient, rolePreset]);

  function setParams(entries) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(entries).forEach(([name, value]) => {
        next.set(name, value);
      });
      if (rolePreset) {
        next.set('asRole', rolePreset);
      }
      return next;
    });
  }

  function setParam(name, value) {
    setParams({ [name]: value });
  }

  function openPortfolio() {
    navigate(withRoleRoute('/portfolio', rolePreset));
  }

  if (productQuery.isLoading) {
    return <div className="page"><div className="empty-panel" data-testid="product-page">Loading product…</div></div>;
  }

  if (productQuery.error) {
    const errorCode = extractApiErrorCode(productQuery.error);
    if (errorCode === 'FORBIDDEN') {
      return <div className="page"><div className="inline-error-panel" data-testid="product-forbidden-view">You don’t have access to this product.</div></div>;
    }
    if (errorCode === 'NOT_FOUND') {
      return <div className="page"><div className="inline-error-panel" data-testid="product-not-found-view">This product doesn’t exist.</div></div>;
    }
    if (errorCode === 'UNAUTHORIZED') {
      return <div className="page"><div className="inline-error-panel" data-testid="product-unauthorized-view">Session expired. Sign in again.</div></div>;
    }
    return <div className="page"><div className="inline-error-panel" data-testid="product-page">We couldn’t load this product. Try again.</div></div>;
  }

  const { product, permissions, health, overview } = productQuery.data;
  const latestIngest = overview.latestIngest;
  const visibleIngest = latestIngest && latestIngest.sourceId !== dismissedStatusSourceId ? latestIngest : null;
  const showTrustSurfaces = trustSurfacesEnabled(sessionQuery.data);

  return (
    <div className="page" data-testid="product-page">
      <div className="product-header">
        <button type="button" className="product-back" data-testid="product-back-link" onClick={openPortfolio}>← Portfolio</button>
        <div className="product-meta">
          <span className="product-meta-item">PI {product.meta.pi} · Sprint {product.meta.sprint}</span>
          <span className="product-meta-item">PM: {product.meta.pm}</span>
          <span className="product-meta-item">Last sync: {new Date(product.meta.lastSync).toLocaleString()}</span>
        </div>
      </div>
      <div className="product-title-row">
        <h1>{product.name}</h1>
        <span className="product-status-badge" data-testid="product-status-badge" style={{ background: product.status === 'risk' ? 'var(--red-100)' : product.status === 'caution' ? 'var(--amber-100)' : 'var(--green-100)', color: product.status === 'risk' ? 'var(--red-700)' : product.status === 'caution' ? 'var(--amber-700)' : 'var(--green-700)' }}>{product.statusLabel}</span>
        {showTrustSurfaces && product.semanticState ? (
          <span
            className="product-semantic-badge"
            data-testid="semantic-freshness-badge"
            style={{
              background: isSemanticStateDegraded(product.semanticState) ? 'var(--amber-100)' : 'var(--green-100)',
              color: isSemanticStateDegraded(product.semanticState) ? 'var(--amber-700)' : 'var(--green-700)',
              borderRadius: 999,
              padding: '0.35rem 0.7rem',
              fontSize: '.78rem',
              fontWeight: 600,
            }}
          >
            {formatSemanticFreshnessLabel(product.semanticState)}
          </span>
        ) : null}
        <span style={{ fontSize: '.82rem', color: 'var(--text-500)' }}>Health: <strong style={{ color: product.healthColor }}>{health.overall}%</strong></span>
      </div>
      <div className="product-tabs">
        {tabValues.map((item) => (
          <button
            key={item}
            type="button"
            className={`ptab ${tab === item ? 'active' : ''}`}
            data-testid={`product-tab-${item}`}
            data-roving-group="product-tabs"
            data-roving-value={item}
            aria-selected={tab === item}
            onClick={() => setParam('tab', item)}
            onKeyDown={(event) => moveFocusInButtonGroup(event, tabValues, item, (nextValue) => setParam('tab', nextValue), 'product-tabs')}
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>
      {visibleIngest ? (
        <ArtifactIngestStatusPanel
          ingest={visibleIngest}
          onViewSources={() => setParams({ tab: 'sources', sourceId: visibleIngest.sourceId })}
          onDismiss={() => setDismissedStatusSourceId(visibleIngest.sourceId)}
        />
      ) : null}
      {tab === 'overview' ? <OverviewView productId={productId} product={product} permissions={permissions} health={health} overview={overview} rolePreset={rolePreset} setParam={setParam} setParams={setParams} showTrustSurfaces={showTrustSurfaces} /> : null}
      {tab === 'timeline' ? <TimelineView productId={productId} rolePreset={rolePreset} searchParams={searchParams} setParam={setParam} /> : null}
      {tab === 'data' ? <DataView productId={productId} rolePreset={rolePreset} searchParams={searchParams} setParam={setParam} /> : null}
      {tab === 'sources' ? <SourcesView productId={productId} rolePreset={rolePreset} searchParams={searchParams} setParam={setParam} showTrustSurfaces={showTrustSurfaces} /> : null}
      {tab === 'reports' ? <ReportsView productId={productId} product={product} permissions={permissions} rolePreset={rolePreset} searchParams={searchParams} setParam={setParam} setSearchParams={setSearchParams} showTrustSurfaces={showTrustSurfaces} /> : null}
    </div>
  );
}

function OverviewView({ productId, product, permissions, health, overview, rolePreset, setParam, setParams, showTrustSurfaces }) {
  const queryClient = useQueryClient();
  const { pushToast } = useToasts();
  const { announce } = useAnnouncements();
  const [askInput, setAskInput] = useState('');
  const [showArtifactModal, setShowArtifactModal] = useState(false);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const askMutation = useMutation({
    mutationFn: (question) => apiSend(withRole(`/api/v1/products/${productId}/ask`, rolePreset), 'POST', { question }),
    onMutate: () => {
      announce('Ask request in progress.');
    },
    onSuccess: () => {
      announce('Ask response ready.');
    },
    onError: () => {
      announce('Ask request failed.');
    },
  });
  const artifactMutation = useMutation({
    mutationFn: ({ formData }) => apiUpload(withRole(`/api/v1/products/${productId}/sources`, rolePreset), formData),
    onSuccess: (payload) => {
      pushToast(payload.status === 'completed' ? 'Artifact processed' : 'Artifact queued for processing');
      setShowArtifactModal(false);
      announce('Artifact queued for processing.');
      queryClient.invalidateQueries({ queryKey: ['product', rolePreset, productId] });
      queryClient.invalidateQueries({ queryKey: ['sources', rolePreset, productId] });
    },
  });
  const weeklyMutation = useMutation({
    mutationFn: (payload) => apiSend(withRole(`/api/v1/products/${productId}/weekly-updates`, rolePreset), 'POST', payload),
    onSuccess: () => {
      pushToast('Weekly update published');
      setShowWeeklyModal(false);
      queryClient.invalidateQueries({ queryKey: ['product', rolePreset, productId] });
      queryClient.invalidateQueries({ queryKey: ['sources', rolePreset, productId] });
    },
  });

  function submitAsk() {
    if (askInput.trim().length < 3) {
      return;
    }
    askMutation.mutate(askInput);
  }

  function retryAsk() {
    if (askInput.trim().length < 3) {
      return;
    }
    askMutation.mutate(askInput);
  }

  return (
    <div className="overview-grid">
      <div>
        <div className="kh-panel" data-testid="knowledge-health-panel">
          <div className="kh-header">
            <h3>Knowledge Health</h3>
            <div className="kh-score-ring" data-testid="knowledge-health-ring" aria-label={`Knowledge health ${health.overall}%`}>
              <svg width="42" height="42" viewBox="0 0 42 42" role="img" aria-hidden="true">
                <circle cx="21" cy="21" r="18" fill="none" stroke="var(--card-border)" strokeWidth="4"></circle>
                <circle
                  cx="21"
                  cy="21"
                  r="18"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.round((health.overall / 100) * 113)} 113`}
                  transform="rotate(-90 21 21)"
                ></circle>
              </svg>
              <span className="kh-score-badge" style={{ background: 'var(--blue-50)', color: 'var(--accent)' }}>{health.overall}%</span>
            </div>
          </div>
          <div className="kh-subs">
            {['coverage', 'freshness', 'continuity', 'sync'].map((key) => (
              <div key={key} className="kh-sub">
                <span className="kh-sub-label">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                <div className="kh-sub-bar"><div className="kh-sub-fill" style={{ width: `${health[key]}%`, background: key === 'coverage' ? 'var(--accent)' : health[key] >= 75 ? 'var(--green-600)' : health[key] >= 50 ? 'var(--amber-600)' : 'var(--red-600)' }}></div></div>
                <span className="kh-sub-val">{health[key]}%</span>
              </div>
            ))}
          </div>
          <div className="kh-gaps">
            {health.okItems.map((item) => <div key={item.id} className="kh-gap-item ok">✓ {item.text}</div>)}
            {health.gapItems.map((item) => <div key={item.id} className={`kh-gap-item ${item.level}`}>{item.level === 'miss' ? '✗' : '⚠'} {item.text}</div>)}
          </div>
          {health.biggestGap ? <div className="evidence-gap-warn"><strong>Biggest gap:</strong> {health.biggestGap}</div> : null}
          <div className="kh-actions">
            {permissions.canUploadArtifact ? <button className="kh-action-btn" data-testid="upload-artifact-button" onClick={() => setShowArtifactModal(true)}>Upload Artifact</button> : null}
            {permissions.canUpdateWeekly ? <button className="kh-action-btn" data-testid="update-weekly-button" onClick={() => setShowWeeklyModal(true)}>Update Weekly</button> : null}
          </div>
        </div>
        {showTrustSurfaces && product.semanticState?.showBanner ? (
          <div className="inline-warning-panel" data-testid="semantic-degraded-banner">
            {product.semanticState.message}
          </div>
        ) : null}
        {overview.latestEvidenceUpdate ? <EvidenceUpdatedBanner update={overview.latestEvidenceUpdate} /> : null}
      </div>
      <div>
        <div className="current-state-card">
          <h3 style={{ marginBottom: 12 }}>Current State</h3>
          <p className="state-narrative" data-testid="overview-current-state" dangerouslySetInnerHTML={{ __html: overview.narrativeHtml }}></p>
          <div className="label" style={{ marginBottom: 10 }}>Recent Signals</div>
          <div className="signals-list">
            {overview.recentSignals.map((signal) => (
              <button
                key={signal.id}
                type="button"
                className="signal-item"
                data-testid={`recent-signal-${signal.id}`}
                data-signal-type={signal.type}
                onClick={() => {
                  setParams({
                    tab: 'timeline',
                    timelineFilter: signalToTimelineFilter(signal.type),
                  });
                }}
              >
                <span className="signal-date">{signal.dateLabel}</span>
                <span className="signal-type" style={{ background: 'var(--blue-50)', color: 'var(--blue-700)' }}>{signal.type}</span>
                <span className="signal-text">{signal.title}</span>
              </button>
            ))}
          </div>
          <button type="button" className="view-timeline-link" onClick={() => setParam('tab', 'timeline')}>View full timeline →</button>
        </div>
      </div>
      <div>
        <div className="ask-panel">
          <h3>Ask About {product.name.split('/')[0].trim()}</h3>
          <div className="ask-input-wrap">
            <input className="ask-input" data-testid="ask-input" value={askInput} onChange={(event) => setAskInput(event.target.value)} placeholder="Ask a question…" onKeyDown={(event) => event.key === 'Enter' ? submitAsk() : undefined} />
            <button className="ask-btn" data-testid="ask-submit" disabled={askInput.trim().length < 3 || askMutation.isPending} onClick={submitAsk}>Ask</button>
          </div>
          <div className="ask-suggestions">
            {overview.askSuggestions.map((suggestion) => <button key={suggestion} type="button" className="ask-suggestion" onClick={() => { setAskInput(suggestion); askMutation.mutate(suggestion); }}>{suggestion}</button>)}
          </div>
          {askMutation.isPending ? <div className="ask-loading" data-testid="ask-loading">Searching current evidence…</div> : null}
          {askMutation.isError ? (
            <div className="inline-error-panel" data-testid="ask-error-state">
              <div>We couldn’t retrieve evidence right now. Try again.</div>
              <button type="button" className="secondary-btn" data-testid="ask-retry" onClick={retryAsk}>Retry</button>
            </div>
          ) : null}
          {askMutation.isSuccess && !askMutation.isPending && !askMutation.isError ? <AskAnswer answer={askMutation.data} onOpenSource={(sourceId) => setParams({ tab: 'sources', sourceId })} showTrustSurfaces={showTrustSurfaces} /> : null}
        </div>
      </div>
      {showArtifactModal ? (
        <UploadArtifactModal
          busy={artifactMutation.isPending}
          onClose={() => setShowArtifactModal(false)}
          onSubmit={(payload) => artifactMutation.mutate(payload)}
          error={artifactMutation.isError ? artifactMutation.error : null}
        />
      ) : null}
      {showWeeklyModal ? <WeeklyModal busy={weeklyMutation.isPending} onClose={() => setShowWeeklyModal(false)} onSubmit={(payload) => weeklyMutation.mutate(payload)} /> : null}
    </div>
  );
}

function AskAnswer({ answer, onOpenSource, showTrustSurfaces }) {
  return (
    <div className="ask-answer visible" data-testid="ask-answer">
      {showTrustSurfaces && answer.semanticState?.showBanner ? (
        <div className="inline-warning-panel" data-testid="ask-degraded-banner">
          {answer.semanticState.message}
        </div>
      ) : null}
      <div className="ask-answer-text" dangerouslySetInnerHTML={{ __html: answer.answerHtml }}></div>
      {answer.coverage.isPartial ? <div className="evidence-gap-warn" data-testid="ask-evidence-gap-warning">{answer.coverage.warnings[0]}</div> : null}
      {answer.retrievalWarnings?.length ? (
        <div className="inline-warning-panel" data-testid="retrieval-not-ready-notice">
          This source is stored but not yet retrievable.
        </div>
      ) : null}
      <div className="evidence-section">
        <h4>Sources</h4>
        {answer.sources.map((source, index) => (
          <button key={source.sourceId} type="button" className="evidence-source" data-testid={`ask-evidence-source-${index}`} onClick={() => onOpenSource(source.sourceId)}>
            <span className="ev-detail">
              <span className="ev-title">{source.title}</span>
              <span className="ev-meta">{source.meta}</span>
              <span className="source-badge" data-testid="ask-source-type-chip">{source.retrievalType || source.type || 'vector'}</span>
              {source.badge === 'field-of-record' ? <span className="source-badge" data-testid="ask-structured-row-badge">field-of-record</span> : null}
              {source.precedenceNote ? <span className="ev-meta" data-testid="ask-precedence-note">{source.precedenceNote}</span> : null}
            </span>
          </button>
        ))}
        <div className={`evidence-strength ${answer.evidenceStrength}`}>● Evidence Strength: {answer.evidenceStrength}</div>
      </div>
    </div>
  );
}

function TimelineView({ productId, rolePreset, searchParams, setParam }) {
  const filter = searchParams.get('timelineFilter') || 'all';
  const filterValues = ['all', 'decision', 'transcript', 'email', 'risk', 'ado', 'weekly', 'document'];
  const [openEntryId, setOpenEntryId] = useState(null);
  const { data } = useQuery({
    queryKey: ['timeline', rolePreset, productId, filter],
    queryFn: () => apiGet(withRole(`/api/v1/products/${productId}/timeline?filter=${filter}`, rolePreset)),
  });

  return (
    <div data-testid="timeline-view">
      {!!data && (
        <>
          <div className="timeline-strip">
            {data.coverageStrip.map((item) => <span key={item.id} className={`ts-item ${item.status}`}>{item.status === 'ok' ? '✓' : item.status === 'warn' ? '⚠' : '✗'} {item.text}</span>)}
          </div>
          <div className="timeline-filters">
            {filterValues.map((item) => (
              <button
                key={item}
                type="button"
                className={`tf-btn ${filter === item ? 'active' : ''}`}
                data-testid={`timeline-filter-${item}`}
                data-roving-group="timeline-filters"
                data-roving-value={item}
                onClick={() => setParam('timelineFilter', item)}
                onKeyDown={(event) => moveFocusInButtonGroup(event, filterValues, item, (nextValue) => setParam('timelineFilter', nextValue), 'timeline-filters')}
              >
                {item === 'all' ? 'All' : item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
          {data.groups.map((group) => (
            <div key={group.dateLabel} className="timeline-group">
              <div className="timeline-connector"></div>
              <div className="timeline-date">{group.dateLabel}</div>
              {group.entries.map((entry) => (
                <div key={entry.id} className={`tl-entry ${openEntryId === entry.id ? 'open' : ''}`} data-testid={`timeline-entry-${entry.id}`} data-type={entry.type}>
                  <div className="tl-entry-row" onClick={() => setOpenEntryId((current) => current === entry.id ? null : entry.id)}>
                    <span className="tl-entry-type" style={{ background: 'var(--blue-50)', color: 'var(--blue-700)' }}>{entry.type}</span>
                    <span className="tl-entry-time">{entry.timeLabel}</span>
                    <span className="tl-entry-title">{entry.title}</span>
                    <span className="tl-entry-expand" data-testid={`timeline-entry-expand-${entry.id}`}>▶</span>
                  </div>
                  <div className="tl-entry-detail">
                    <p>{entry.detail}</p>
                    <button
                      type="button"
                      className="tl-source-link"
                      onClick={() => {
                        setParam('sourceId', entry.sourceRef.sourceId);
                        setParam('tab', 'sources');
                      }}
                    >
                      View Source: {entry.sourceRef.label} →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function DataView({ productId, rolePreset, searchParams, setParam }) {
  const dataTab = searchParams.get('dataTab') || 'risks';
  const dataTabValues = ['risks', 'blockers', 'pi'];
  const [openRowId, setOpenRowId] = useState(null);
  const { data } = useQuery({
    queryKey: ['data', rolePreset, productId, dataTab],
    queryFn: () => apiGet(withRole(`/api/v1/products/${productId}/data?dataset=${dataTab}`, rolePreset)),
  });

  return (
    <div data-testid="data-view">
      <div className="data-subtabs">
        {[{ id: 'risks', label: 'Risks & Issues' }, { id: 'blockers', label: 'Blockers' }, { id: 'pi', label: 'PI Objectives' }].map((item) => (
          <button
            key={item.id}
            type="button"
            className={`dst-btn ${dataTab === item.id ? 'active' : ''}`}
            data-testid={`data-subtab-${item.id}`}
            data-roving-group="data-subtabs"
            data-roving-value={item.id}
            onClick={() => setParam('dataTab', item.id)}
            onKeyDown={(event) => moveFocusInButtonGroup(event, dataTabValues, item.id, (nextValue) => setParam('dataTab', nextValue), 'data-subtabs')}
          >
            {item.label}
          </button>
        ))}
      </div>
      {data?.importImpact ? (
        <div className="data-import-impact-badge" data-testid="data-import-impact-badge">
          Structured import applied from {data.importImpact.title}. This upload updates structured product data shown in the Data tab.
        </div>
      ) : null}
      {data ? (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {dataTab === 'pi'
                  ? <><th>ID</th><th>Objective</th><th>Status</th><th>Progress</th></>
                  : <><th>ID</th><th>Title</th><th>Severity</th><th>Status</th><th>Owner</th><th>Last Changed</th></>}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => dataTab === 'pi'
                ? (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.title}</td>
                    <td><span className={`status-badge-sm ${formatStatusClass(row.status)}`}>{row.status}</span></td>
                    <td><div className="progress-bar"><div className="progress-fill" style={{ width: `${row.progressPct}%`, background: row.status === 'done' ? 'var(--green-600)' : row.status === 'at-risk' ? 'var(--red-600)' : 'var(--accent)' }}></div></div>{row.progressPct}%</td>
                  </tr>
                )
                : (
                  <Fragment key={row.id}>
                    <tr key={row.id} data-testid={`data-row-${row.id}`} onClick={() => setOpenRowId((current) => current === row.id ? null : row.id)}>
                      <td>{row.id}</td>
                      <td>{row.title}</td>
                      <td><span className={`severity-badge ${row.severity === 'med' ? 'med' : row.severity}`}>{row.severity}</span></td>
                      <td><span className={`status-badge-sm ${formatStatusClass(row.status)}`}>{row.status}</span></td>
                      <td>{row.owner}</td>
                      <td>{new Date(row.changed).toLocaleDateString()}</td>
                    </tr>
                    <tr>
                      <td colSpan="6" style={{ padding: 0 }}>
                        <div className={`data-detail-panel ${openRowId === row.id ? 'visible' : ''}`} data-testid={`data-detail-${row.id}`}>
                          <div className="ddp-title">{row.id}: {row.title}</div>
                          <div className="ddp-field"><strong>Description:</strong> {row.description}</div>
                          <div className="ddp-field"><strong>Mitigation:</strong> {row.mitigation}</div>
                          {row.relatedEvents.map((event) => <div key={event} className="ddp-event">{event}</div>)}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function SourcesView({ productId, rolePreset, searchParams, setParam, showTrustSurfaces }) {
  const filter = searchParams.get('sourceFilter') || 'all';
  const sourceId = searchParams.get('sourceId');
  const sourceFilterValues = ['all', 'transcript', 'slide_deck', 'spreadsheet', 'email', 'document', 'weekly', 'ado'];
  const triggerRef = useRef(null);
  const { data } = useQuery({
    queryKey: ['sources', rolePreset, productId, filter],
    queryFn: () => apiGet(withRole(`/api/v1/products/${productId}/sources?type=${filter}`, rolePreset)),
  });
  const sourceDetailQuery = useQuery({
    queryKey: ['source-detail', rolePreset, productId, sourceId],
    enabled: Boolean(sourceId),
    queryFn: () => apiGet(withRole(`/api/v1/products/${productId}/sources/${sourceId}`, rolePreset)),
  });

  function closeSourceDetail() {
    setParam('sourceId', '');
    window.setTimeout(() => triggerRef.current?.focus?.(), 0);
  }

  useEffect(() => {
    if (!sourceId) {
      return;
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        closeSourceDetail();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sourceId, searchParams]);

  return (
    <div data-testid="sources-view">
      <div className="source-filters">
        {sourceFilterValues.map((item) => (
          <button
            key={item}
            type="button"
            className={`tf-btn ${filter === item ? 'active' : ''}`}
            data-testid={`source-filter-${item}`}
            data-roving-group="source-filters"
            data-roving-value={item}
            onClick={() => setParam('sourceFilter', item)}
            onKeyDown={(event) => moveFocusInButtonGroup(event, sourceFilterValues, item, (nextValue) => setParam('sourceFilter', nextValue), 'source-filters')}
          >
            {item === 'all' ? 'All' : item.replace('_', ' ')}
          </button>
        ))}
      </div>
      <div className="source-list">
        {data?.items.map((source) => (
          <button
            key={source.id}
            type="button"
            className={`source-item ${source.processingStatus}`}
            data-testid={`source-item-${source.id}`}
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              setParam('sourceId', source.id);
            }}
          >
            <div className="source-info">
              <div className="source-title">{source.title}</div>
              <div className="source-meta">{source.date} · {source.meta}</div>
            </div>
            <span className="source-badge" style={{ background: source.processingStatus === 'partial' ? 'var(--amber-100)' : 'var(--blue-50)', color: source.processingStatus === 'partial' ? 'var(--amber-700)' : 'var(--blue-700)' }}>{source.typeLabel}</span>
          </button>
        ))}
      </div>
      {sourceId && sourceDetailQuery.data ? (
        <div className="side-overlay" onClick={closeSourceDetail}>
          <div className="side-panel" data-testid="source-detail-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="report-section-header">
              <h3>{sourceDetailQuery.data.source.title}</h3>
              <button className="secondary-btn" onClick={closeSourceDetail}>Close</button>
            </div>
            <div className="ddp-field"><strong>Date:</strong> {new Date(sourceDetailQuery.data.source.sourceDate).toLocaleString()}</div>
            <div className="ddp-field"><strong>Author:</strong> {sourceDetailQuery.data.source.author}</div>
            {sourceDetailQuery.data.source.warningText ? <div className="inline-warning-panel" data-testid="source-parser-warning">{sourceDetailQuery.data.source.warningText}</div> : null}
            <div className="ddp-field" data-testid="source-family-class"><strong>Source family class:</strong> {sourceDetailQuery.data.source.sourceFamilyClass}</div>
            {sourceDetailQuery.data.source.indexingStatus !== 'not_applicable' ? (
              <div className="ddp-field" data-testid="source-indexing-status"><strong>Indexing status:</strong> {sourceDetailQuery.data.source.indexingStatus}</div>
            ) : null}
            <div className="ddp-field" data-testid="source-detail-summary"><strong>Summary:</strong> {sourceDetailQuery.data.source.summary}</div>
            {showTrustSurfaces ? <div className="ddp-field" data-testid="source-detail-citation-mode"><strong>Citation mode:</strong> {sourceDetailQuery.data.source.citationMode}</div> : null}
            {showTrustSurfaces && sourceDetailQuery.data.source.warnings?.length ? <div className="inline-warning-panel" data-testid="source-detail-warnings">{sourceDetailQuery.data.source.warnings.join(' ')}</div> : null}
            {showTrustSurfaces ? <div className="ddp-field" data-testid="source-detail-citations"><strong>Citations:</strong> {sourceDetailQuery.data.source.citations?.length ? sourceDetailQuery.data.source.citations.map((citation) => citation.label || citation.kind).join(' · ') : 'No citations available'}</div> : null}
            {showTrustSurfaces && sourceDetailQuery.data.source.citationMode !== 'exact' ? (
              <div className="inline-warning-panel">
                Exact coordinates were unavailable for this source. Showing the best available reference.
              </div>
            ) : null}
            {sourceDetailQuery.data.source.indexingStatus === 'failed' ? (
              <div className="inline-warning-panel">This source was stored, but indexing did not complete. Re-upload the file once the embedding service is available.</div>
            ) : null}
            {sourceDetailQuery.data.source.indexingStatus === 'disabled' ? (
              <div className="inline-warning-panel">Retrieval indexing is currently disabled for Dental. This source is stored and published, but Ask cannot cite it until indexing is re-enabled.</div>
            ) : null}
            {sourceDetailQuery.data.source.indexingStatus === 'queued' ? (
              <div className="inline-warning-panel">Indexing in progress. This source will become searchable once indexing completes.</div>
            ) : null}
            <div className="ddp-field" data-testid="source-preview-content"><strong>Preview:</strong> {sourceDetailQuery.data.source.previewText}</div>
            <div className="drawer-actions">
              {sourceDetailQuery.data.source.binary
                ? <a className="primary-btn" data-testid="source-download-original" href={withRole(sourceDetailQuery.data.source.openUrl, rolePreset)}>Download Original</a>
                : <a className="primary-btn" data-testid="source-open-source" href={withRole(sourceDetailQuery.data.source.openUrl, rolePreset)}>Open Source</a>}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
function formatReportPeriod(period) {
  if (!period?.start || !period?.end) {
    return 'Current imported period';
  }

  const start = new Date(period.start);
  const end = new Date(period.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Current imported period';
  }

  const startLabel = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

function ReportsView({ productId, product, permissions, rolePreset, searchParams, setParam, setSearchParams, showTrustSurfaces }) {
  const reportId = searchParams.get('reportId');
  const reportJobId = searchParams.get('reportJobId');
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [editRevision, setEditRevision] = useState(null);
  const [busyFormat, setBusyFormat] = useState('');
  const [forceReportLoading, setForceReportLoading] = useState(false);
  const { pushToast } = useToasts();
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: () => apiSend(withRole(`/api/v1/products/${productId}/reports`, rolePreset), 'POST', { reportType: 'weekly', period: { preset: 'current' } }),
    onSuccess: (payload) => {
      setForceReportLoading(true);
      window.setTimeout(() => setForceReportLoading(false), 400);
      setParam('reportJobId', payload.jobId);
    },
  });

  const jobQuery = useQuery({
    queryKey: ['job', reportJobId],
    enabled: Boolean(reportJobId),
    queryFn: () => apiGet(withRole(`/api/v1/jobs/${reportJobId}`, rolePreset)),
    refetchInterval: (query) => (['completed', 'failed'].includes(query.state.data?.status) ? false : 400),
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (jobQuery.data?.status === 'completed' && jobQuery.data.result?.reportId) {
      const next = new URLSearchParams(searchParams);
      next.set('reportId', jobQuery.data.result.reportId);
      next.delete('reportJobId');
      if (rolePreset) {
        next.set('asRole', rolePreset);
      }
      setSearchParams(next);
    }
  }, [jobQuery.data, rolePreset, searchParams, setSearchParams]);

  const reportQuery = useQuery({
    queryKey: ['report', rolePreset, productId, reportId],
    enabled: Boolean(reportId),
    queryFn: () => apiGet(withRole(`/api/v1/products/${productId}/reports/${reportId}`, rolePreset)),
  });

  const saveMutation = useMutation({
    mutationFn: ({ sectionId, body, expectedRevision }) => apiSend(
      withRole(`/api/v1/products/${productId}/reports/${reportId}/sections/${sectionId}`, rolePreset),
      'PATCH',
      { body, expectedRevision }
    ),
    onSuccess: (payload) => {
      pushToast('Report section saved');
      setEditingSectionId(null);
      setEditRevision(payload.revision);
      queryClient.invalidateQueries({ queryKey: ['report', rolePreset, productId, reportId] });
    },
    onError: (error) => {
      const code = extractApiErrorCode(error);
      if (code === 'CONFLICT') {
        pushToast('This section was updated elsewhere. Refresh and try again.');
        queryClient.invalidateQueries({ queryKey: ['report', rolePreset, productId, reportId] });
        return;
      }
      pushToast('Something went wrong. Try again.');
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (format) => {
      setBusyFormat(format);
      const job = await apiSend(withRole(`/api/v1/products/${productId}/reports/${reportId}/exports`, rolePreset), 'POST', { format });
      let status = job;
      while (!['completed', 'failed'].includes(status.status)) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        status = await apiGet(withRole(`/api/v1/jobs/${job.jobId}`, rolePreset));
      }
      if (status.status === 'failed') {
        const exportFailure = new Error(status.message || 'Export failed');
        exportFailure.error = { code: status.errorCode || 'INTERNAL_ERROR' };
        throw exportFailure;
      }
      return status.result;
    },
    onSuccess: (result) => {
      pushToast(`${result.format.toUpperCase()} export started`);
      window.open(withRoleRoute(result.downloadUrl, rolePreset), '_blank');
    },
    onError: () => {
      pushToast('We couldn’t generate the report export. Try again.');
    },
    onSettled: () => {
      setBusyFormat('');
    },
  });

  function startEdit(section) {
    setEditingSectionId(section.sectionId);
    setEditBody(section.body);
    setEditRevision(Number.isFinite(section.revision) ? section.revision : 1);
  }

  if (!reportId && !reportJobId) {
    return (
      <div data-testid="reports-view">
        <div className="report-config">
          <label>Report Type:</label>
          <select defaultValue="weekly">
            <option value="weekly">Weekly</option>
            <option value="sprint">Sprint</option>
            <option value="pi">PI</option>
          </select>
          <label>Period:</label>
          <select defaultValue="current">
            <option value="current">{`Current imported period for ${product.name}`}</option>
          </select>
          <button
            className="generate-btn"
            data-testid="generate-report-button"
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            ▶ Generate Report
          </button>
        </div>
        <div className="empty-panel">Select a report type and period, then click Generate Report.</div>
      </div>
    );
  }

  if (forceReportLoading || generateMutation.isPending || (reportJobId && !['completed', 'failed'].includes(jobQuery.data?.status || 'pending'))) {
    return (
      <div data-testid="reports-view">
        <div className="report-loading" data-testid="report-loading">
          <div className="report-spinner"></div>
          <div>Analyzing sources and generating report…</div>
        </div>
      </div>
    );
  }

  if (reportJobId && jobQuery.data?.status === 'failed') {
    return (
      <div data-testid="reports-view">
        <div className="inline-error-panel" data-testid="inline-error-panel">
          We couldn’t generate the report. Try again.
        </div>
      </div>
    );
  }

  const report = reportQuery.data;
  if (!report) {
    return (
      <div data-testid="reports-view">
        <div className="empty-panel">Loading report…</div>
      </div>
    );
  }

  return (
    <div data-testid="reports-view">
      {showTrustSurfaces && report.semanticState?.showBanner ? (
        <div className="inline-warning-panel" data-testid="report-semantic-state-banner">
          {report.semanticState.message}
        </div>
      ) : null}
      {report.requiresRegeneration ? (
        <div className="inline-warning-panel" data-testid="report-regenerate-notice">
          {report.regenerateNotice}
          <button type="button" className="secondary-btn" data-testid="report-regenerate-button" onClick={() => generateMutation.mutate()}>Regenerate</button>
        </div>
      ) : null}
      <div className="report-coverage" data-testid="report-coverage-card">
        <h3>Evidence Coverage for This Period</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: '.82rem', color: 'var(--text-500)' }}>Coverage:</span>
          <div className="progress-bar" style={{ width: 120 }}>
            <div
              className="progress-fill"
              style={{
                width: `${report.coverage.percentage}%`,
                background: report.coverage.percentage >= 85 ? 'var(--green-600)' : report.coverage.percentage >= 60 ? 'var(--amber-600)' : 'var(--red-600)',
              }}
            ></div>
          </div>
          <span
            style={{
              fontSize: '.85rem',
              fontWeight: 600,
              color: report.coverage.percentage >= 85 ? 'var(--green-700)' : report.coverage.percentage >= 60 ? 'var(--amber-700)' : 'var(--red-700)',
            }}
          >
            {report.coverage.percentage}%
          </span>
        </div>
        <div className="rc-grid">
          {report.coverage.items.map((item) => (
            <span key={item.label} className={`rc-item ${item.status}`}>
              {item.status === 'ok' ? '✓' : '⚠'} {item.label} — {item.count}{item.expected ? ` of ${item.expected}` : ''}
            </span>
          ))}
        </div>
        <div className="rc-warn">{report.coverage.warningText}</div>
      </div>
      <div className="report-output">
        <div className="report-header-bar">
          <h2>{`${report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)} Report — ${product.name}`}</h2>
          <div className="rh-meta">{`${formatReportPeriod(report.period)} · PI ${product.meta.pi} · Sprint ${product.meta.sprint} · PM: ${product.meta.pm}`}</div>
        </div>
        {report.sections.map((section) => (
          <div key={section.sectionId} className="report-section" data-testid={`report-section-${section.sectionId}`}>
            <div className="report-section-header">
              <h3>{section.title}</h3>
              {permissions.canEditReport ? (
                <button className="report-edit-btn" data-testid={`report-edit-${section.sectionId}`} onClick={() => startEdit(section)}>✏️ Edit</button>
              ) : null}
            </div>
            {editingSectionId === section.sectionId ? (
              <div className="report-edit-area">
                <textarea
                  data-testid={`report-edit-textarea-${section.sectionId}`}
                  value={editBody}
                  onChange={(event) => setEditBody(event.target.value)}
                ></textarea>
                <div className="modal-actions">
                  <button className="secondary-btn" onClick={() => setEditingSectionId(null)}>Cancel</button>
                  <button
                    className="primary-btn"
                    data-testid={`report-save-${section.sectionId}`}
                    onClick={() => saveMutation.mutate({ sectionId: section.sectionId, body: editBody, expectedRevision: editRevision })}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p>{section.body}</p>
            )}
          </div>
        ))}
        <div className="report-export-bar">
          <button className="export-btn" data-testid="export-pdf" aria-busy={busyFormat === 'pdf'} onClick={() => exportMutation.mutate('pdf')}>📥 Export PDF</button>
          <button className="export-btn" data-testid="export-pptx" aria-busy={busyFormat === 'pptx'} onClick={() => exportMutation.mutate('pptx')}>📥 Export PPTX</button>
          <button className="export-btn" data-testid="export-copy" aria-busy={busyFormat === 'copy'} onClick={() => exportMutation.mutate('copy')}>📋 Copy to Clipboard</button>
          <button className="export-btn" data-testid="export-email" aria-busy={busyFormat === 'email'} onClick={() => exportMutation.mutate('email')}>📧 Email Report</button>
        </div>
      </div>
    </div>
  );
}

function ArtifactIngestStatusPanel({ ingest, onViewSources, onDismiss }) {
  const statusLabel = ingest.status === 'completed'
    ? 'Completed'
    : ingest.status === 'partial'
      ? 'Processed with limitations'
      : ingest.status === 'failed'
        ? 'Failed'
        : ingest.status === 'running'
          ? 'Processing'
          : 'Queued';
  const testId = ingest.status === 'completed'
    ? 'artifact-processing-complete'
    : ingest.status === 'partial'
      ? 'artifact-processing-warning'
      : ingest.status === 'failed'
        ? 'artifact-processing-error'
        : 'artifact-processing-status';

  return (
    <div className={`artifact-status-panel ${ingest.status}`} data-testid={testId}>
      <div>
        <div className="asp-title">Artifact Processing</div>
        <div className="asp-copy">
          {ingest.title} · {statusLabel}
          {ingest.executionMode ? ` · ${ingest.executionMode}` : ''}
        </div>
        {ingest.warningText ? <div className="asp-warning">{ingest.warningText}</div> : null}
      </div>
      <div className="asp-actions">
        <button type="button" className="secondary-btn" onClick={onViewSources}>View in Sources</button>
        {['completed', 'failed', 'partial'].includes(ingest.status) ? <button type="button" className="secondary-btn" onClick={onDismiss}>Dismiss</button> : null}
      </div>
    </div>
  );
}

function EvidenceUpdatedBanner({ update }) {
  if (!update?.message) {
    return null;
  }
  return <div className="evidence-updated-banner" data-testid="evidence-updated-banner">{update.message}</div>;
}

function UploadArtifactModal({ busy, onClose, onSubmit, error }) {
  const titleRef = useRef(null);
  const triggerRef = useRef(null);
  const { register, setValue, getValues, watch, setError, clearErrors, formState: { errors } } = useForm({
    defaultValues: {
      title: '',
      sourceDate: '',
      sourceType: '',
      author: '',
      participants: '',
      notes: '',
      structuredImpactConfirmed: false,
    },
  });
  const [artifactFile, setArtifactFile] = useState(null);
  const [metadataFile, setMetadataFile] = useState(null);
  const selectedType = watch('sourceType');
  const sourceOptions = artifactFile ? getSourceTypeOptions(artifactFile.name) : [];
  const defaultType = artifactFile ? getDefaultSourceType(artifactFile.name) : '';
  const lockedType = artifactFile && sourceOptions.length === 1;

  useEffect(() => {
    triggerRef.current = document.activeElement;
    window.setTimeout(() => titleRef.current?.focus(), 0);
    function onKeyDown(event) {
      if (event.key === 'Escape' && !busy) {
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      triggerRef.current?.focus?.();
    };
  }, [busy, onClose]);

  useEffect(() => {
    if (!error?.error?.field) {
      return;
    }
    setError(error.error.field, { type: 'server', message: error.error.message });
  }, [error, setError]);

  function handleArtifactFile(file) {
    setArtifactFile(file || null);
    clearErrors('file');
    clearErrors('sourceType');
    if (!file) {
      return;
    }
    if (!isSupportedArtifactFile(file.name)) {
      setError('file', { type: 'manual', message: 'File type not supported' });
      return;
    }
    const inferredTitle = buildArtifactTitle(file.name);
    if (!getValues('title')) {
      setValue('title', inferredTitle, { shouldDirty: true });
    }
    const inferredType = getDefaultSourceType(file.name);
    setValue('sourceType', inferredType, { shouldDirty: true, shouldValidate: true });
  }

  function validateForm() {
    const values = getValues();
    let valid = true;
    if (!artifactFile) {
      setError('file', { type: 'manual', message: 'Choose an artifact file' });
      valid = false;
    } else if (!isSupportedArtifactFile(artifactFile.name)) {
      setError('file', { type: 'manual', message: 'File type not supported' });
      valid = false;
    }
    if (!values.sourceDate) {
      setError('sourceDate', { type: 'manual', message: 'Choose a source date' });
      valid = false;
    } else if (new Date(`${values.sourceDate}T00:00:00Z`).getTime() > new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`).getTime()) {
      setError('sourceDate', { type: 'manual', message: 'Source date cannot be in the future' });
      valid = false;
    }
    if (!values.sourceType) {
      setError('sourceType', { type: 'manual', message: 'Choose a source type' });
      valid = false;
    }
    if (isStructuredImportType(values.sourceType) && !values.structuredImpactConfirmed) {
      setError('structuredImpactConfirmed', { type: 'manual', message: 'Confirm that this upload updates structured product data' });
      valid = false;
    }
    return valid;
  }

  function buildPayload() {
    const values = getValues();
    const formData = new FormData();
    formData.append('file', artifactFile);
    formData.append('sourceType', values.sourceType);
    formData.append('sourceDate', values.sourceDate);
    formData.append('title', values.title || '');
    formData.append('author', values.author || '');
    formData.append('participants', values.participants || '');
    formData.append('notes', values.notes || '');
    formData.append('structuredImpactConfirmed', values.structuredImpactConfirmed ? 'true' : 'false');
    if (metadataFile) {
      formData.append('metadataFile', metadataFile);
    }
    return { formData };
  }

  function submit(event) {
    event.preventDefault();
    clearErrors();
    if (!validateForm()) {
      return;
    }
    onSubmit(buildPayload());
  }

  return (
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div className="modal-panel artifact-modal-panel" data-testid="upload-artifact-modal" onClick={(event) => event.stopPropagation()}>
        <h2 ref={titleRef} tabIndex={-1} data-testid="artifact-modal-title">Upload Artifact</h2>
        <p className="modal-helper">Upload one supported artifact at a time. The application will process it and update evidence-driven views when processing completes.</p>
        <form className="form-grid" onSubmit={submit}>
          <div className="form-field">
            <label htmlFor="artifact-file">Artifact file</label>
            <input id="artifact-file" type="file" data-testid="artifact-file-input" onChange={(event) => handleArtifactFile(event.target.files?.[0] || null)} />
            {errors.file ? <span className="field-error" data-testid="artifact-file-error">{errors.file.message}</span> : null}
          </div>
          <div className="form-grid two">
            <div className="form-field">
              <label htmlFor="artifact-source-type">Source type</label>
              <select
                id="artifact-source-type"
                data-testid="artifact-source-type-select"
                disabled={lockedType}
                value={selectedType}
                onChange={(event) => setValue('sourceType', event.target.value, { shouldDirty: true, shouldValidate: true })}
              >
                <option value="">Select a source type</option>
                {sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              {errors.sourceType ? <span className="field-error" data-testid="artifact-source-type-error">{errors.sourceType.message}</span> : null}
            </div>
            <div className="form-field">
              <label htmlFor="artifact-date">Source date</label>
              <input id="artifact-date" type="date" data-testid="artifact-date-input" {...register('sourceDate')} />
              {errors.sourceDate ? <span className="field-error" data-testid="artifact-date-error">{errors.sourceDate.message}</span> : null}
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="artifact-title">Title</label>
            <input id="artifact-title" data-testid="artifact-title-input" {...register('title')} />
            {errors.title ? <span className="field-error" data-testid="artifact-title-error">{errors.title.message}</span> : null}
          </div>
          <div className="form-grid two">
            <div className="form-field">
              <label htmlFor="artifact-author">Author</label>
              <input id="artifact-author" data-testid="artifact-author-input" {...register('author')} />
            </div>
            <div className="form-field">
              <label htmlFor="artifact-participants">Participants</label>
              <input id="artifact-participants" data-testid="artifact-participants-input" {...register('participants')} />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="artifact-notes">Notes</label>
            <textarea id="artifact-notes" data-testid="artifact-notes-input" {...register('notes')}></textarea>
          </div>
          <div className="form-field">
            <label htmlFor="artifact-metadata-file">Metadata file</label>
            <input id="artifact-metadata-file" type="file" data-testid="artifact-metadata-file-input" onChange={(event) => setMetadataFile(event.target.files?.[0] || null)} />
          </div>
          {isStructuredImportType(selectedType) ? (
            <label className="structured-impact-confirm" data-testid="structured-impact-confirmation">
              <input type="checkbox" {...register('structuredImpactConfirmed')} />
              <span>This upload updates structured product data shown in the Data tab.</span>
            </label>
          ) : (
            <div className="modal-helper subtle">Structured imports can update product tables. Narrative documents, decks, emails, and transcripts enrich evidence and reporting without directly overwriting structured rows.</div>
          )}
          {errors.structuredImpactConfirmed ? <span className="field-error">{errors.structuredImpactConfirmed.message}</span> : null}
          {error?.error && !error.error.field ? (
            <div className="inline-error-panel" data-testid="artifact-inline-error">
              <div>We couldn’t process this artifact right now. Your entries are still here. Review the error and try again.</div>
              {error.error.retryable ? <button type="button" className="secondary-btn" data-testid="artifact-retry-button" onClick={() => onSubmit(buildPayload())}>Retry</button> : null}
            </div>
          ) : null}
          <div className="modal-actions">
            <button type="button" className="secondary-btn" data-testid="artifact-cancel" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="primary-btn" data-testid="artifact-submit" disabled={busy}>{busy ? 'Uploading…' : 'Upload Artifact'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WeeklyModal({ busy, onClose, onSubmit }) {
  const { register, handleSubmit, formState: { errors } } = useForm();
  return <div className="modal-overlay" onClick={onClose}><div className="modal-panel" data-testid="update-weekly-modal" onClick={(event) => event.stopPropagation()}><h2>Update Weekly</h2><form className="form-grid" onSubmit={handleSubmit(onSubmit)}><div className="form-field"><label htmlFor="weekly-week-ending">Week Ending *</label><input id="weekly-week-ending" data-testid="weekly-week-ending-input" type="date" {...register('weekEnding', { required: 'Choose a week ending date' })} />{errors.weekEnding ? <span className="field-error">{errors.weekEnding.message}</span> : null}</div><div className="form-field"><label htmlFor="weekly-summary">Summary *</label><textarea id="weekly-summary" data-testid="weekly-summary-input" {...register('summary', { required: 'Enter a summary between 100 and 1500 characters', minLength: 100 })}></textarea>{errors.summary ? <span className="field-error">{errors.summary.message}</span> : null}</div><div className="form-field"><label htmlFor="weekly-accomplishments">Accomplishments *</label><textarea id="weekly-accomplishments" data-testid="weekly-accomplishments-input" {...register('accomplishments', { required: 'Enter accomplishments for this period' })}></textarea>{errors.accomplishments ? <span className="field-error">{errors.accomplishments.message}</span> : null}</div><div className="form-field"><label htmlFor="weekly-risks">Risks</label><textarea id="weekly-risks" data-testid="weekly-risks-input" {...register('risks')}></textarea></div><div className="form-field"><label htmlFor="weekly-next-steps">Next Steps *</label><textarea id="weekly-next-steps" data-testid="weekly-next-steps-input" {...register('nextSteps', { required: 'Enter next steps', minLength: 20 })}></textarea>{errors.nextSteps ? <span className="field-error">{errors.nextSteps.message}</span> : null}</div><div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancel</button><button type="submit" className="primary-btn" data-testid="weekly-submit" disabled={busy}>Publish Update</button></div></form></div></div>;
}
