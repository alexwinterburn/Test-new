import { HashRouter, Route, Routes } from 'react-router-dom'
import { StoreProvider } from './lib/store'
import { ClientLayout } from './client/ClientLayout'
import { Home } from './client/Home'
import { MarketDetail } from './client/MarketDetail'
import { Portfolio } from './client/Portfolio'
import { Wallet } from './client/Wallet'
import { AdminLayout } from './admin/AdminLayout'
import { Dashboard } from './admin/Dashboard'
import { AdminMarkets } from './admin/Markets'
import { MarketCreate } from './admin/MarketCreate'
import { AdminKyc, AdminUsers } from './admin/Users'
import { AdminAudit, AdminFinance, AdminFlags, AdminProposals, AdminRisk } from './admin/Ops'

export const App = () => (
  <StoreProvider>
    <HashRouter>
      <Routes>
        <Route element={<ClientLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/market/:id" element={<MarketDetail />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/wallet" element={<Wallet />} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="markets" element={<AdminMarkets />} />
          <Route path="markets/new" element={<MarketCreate />} />
          <Route path="proposals" element={<AdminProposals />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="kyc" element={<AdminKyc />} />
          <Route path="finance" element={<AdminFinance />} />
          <Route path="risk" element={<AdminRisk />} />
          <Route path="flags" element={<AdminFlags />} />
          <Route path="audit" element={<AdminAudit />} />
        </Route>
      </Routes>
    </HashRouter>
  </StoreProvider>
)
