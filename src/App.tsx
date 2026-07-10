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
import { AdminAnalytics, AdminAnnounce, AdminCompliance, AdminLiquidity } from './admin/Desk'
import { AdminApi } from './admin/Api'
import { AdminComms, AdminData } from './admin/Comms'
import { Leaderboard } from './client/Leaderboard'
import { Earn } from './client/Earn'
import { Embed } from './client/Embed'
import { Developers } from './client/Developers'

export const App = () => (
  <StoreProvider>
    <HashRouter>
      <Routes>
        <Route element={<ClientLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/market/:id" element={<MarketDetail />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/earn" element={<Earn />} />
          <Route path="/developers" element={<Developers />} />
          <Route path="/wallet" element={<Wallet />} />
        </Route>
        <Route path="/embed/:id" element={<Embed />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="markets" element={<AdminMarkets />} />
          <Route path="markets/new" element={<MarketCreate />} />
          <Route path="proposals" element={<AdminProposals />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="kyc" element={<AdminKyc />} />
          <Route path="finance" element={<AdminFinance />} />
          <Route path="liquidity" element={<AdminLiquidity />} />
          <Route path="risk" element={<AdminRisk />} />
          <Route path="compliance" element={<AdminCompliance />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="announce" element={<AdminAnnounce />} />
          <Route path="api" element={<AdminApi />} />
          <Route path="comms" element={<AdminComms />} />
          <Route path="data" element={<AdminData />} />
          <Route path="flags" element={<AdminFlags />} />
          <Route path="audit" element={<AdminAudit />} />
        </Route>
      </Routes>
    </HashRouter>
  </StoreProvider>
)
