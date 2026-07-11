# Getting Started — run Foresight on your PC or phone

No coding experience needed. You only need **Node.js** (free, from
[nodejs.org](https://nodejs.org) — pick the LTS version).

> The app currently lives on the branch
> **`claude/prediction-markets-prototype-4fg6rf`**.

## 1. Get the code

**Way A — ZIP (no Git):** on the GitHub page, switch the branch selector to
`claude/prediction-markets-prototype-4fg6rf`, click the green **Code** button →
**Download ZIP**, and unzip it.

**Way B — Git:**

```bash
git clone https://github.com/alexwinterburn/Test-new.git
cd Test-new
git checkout claude/prediction-markets-prototype-4fg6rf
```

## 2. Run it on your computer

Open a terminal in the app folder, then:

```bash
npm install    # one-time, ~1 minute
npm run dev    # prints: ➜ Local: http://localhost:5173/
```

Open that address in your browser. Stop with `Ctrl+C`.

## 3. Use it

- You start signed in as the demo trader (Alex, $2,450). Try buying YES on a
  market; explore Portfolio, Wallet, Earn, Leaderboard, Developers.
- Other demo account: `dana@example.com` (verified pro). Or sign up with any
  email / Google / Apple / X (all simulated).
- **Admin panel:** footer → *Admin console* → *Enter as demo admin*.
- **Reset all demo data:** Admin → Data studio → *Reset demo data*.

## 4. Open it on your phone (same Wi-Fi)

```bash
npm run dev -- --host
```

The terminal shows a `Network:` address like `http://192.168.1.23:5173/` —
type it into your phone's browser. Allow Node through the firewall if asked.

## 5. Zero-install options

- **StackBlitz:** stackblitz.com → *Import from GitHub* → paste the repo URL
  (with branch). Runs in the browser, preview URL works on phones.
- **GitHub Codespaces:** green **Code** button → *Codespaces* → create; then
  `npm install && npm run dev` in its terminal and open the forwarded port.

## 6. Free hosting (a permanent link for any phone)

- **Vercel:** vercel.com → *Add New Project* → pick this repo + branch →
  Deploy (Vite is auto-detected).
- **Netlify:** build command `npm run build`, publish folder `dist`.

Hash routing + per-browser storage mean static hosting works perfectly: every
visitor gets their own private demo copy.

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| `npm is not recognized` | Install Node LTS, then close & reopen the terminal |
| Port already in use | `npm run dev -- --port 5174` |
| Install errors | delete `node_modules`, run `npm install` again |
| Blank page | use the exact printed URL incl. port; hard refresh |
| Broken/odd data | Admin → Data studio → Reset demo data |

*Prototype reminder: all balances, markets, emails and identity checks are
simulated — no real money is ever involved.*
