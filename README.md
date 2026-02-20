# 🐸 Froggy dApp — Sei EVM

Official dApp for the $FROG ecosystem on Sei EVM.

## Features

- 🔄 Token Swap (SEI / USDY → FROG via DragonSwap router)
- 💧 Liquidity (FROG/WSEI + USDY/FROG)
- 📊 Dashboard (Froggy Streak check-in + stats)
- 📈 Live pricing + pool stats (Dexscreener + Coingecko backed API routes)

Built with Next.js App Router, wagmi, viem, and React Query.

---

## Network

- Chain: Sei EVM Mainnet  
- Chain ID: 1329

---

## Core Contracts

Defined in `src/lib/froggyConfig.ts`.

| Name | Address |
|------|----------|
| FROG Token | 0xF9BDbF259eCe5ae17e29BF92EB7ABd7B8b465Db9 |
| DragonSwap Router | 0xa4cF2F53D1195aDDdE9e4D3aCa54f556895712f2 |
| wSEI | 0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7 |
| FROG/WSEI Pair | 0x373e718e54e73fb462fec3a73e9645efea280b84 |
| USDY/FROG Pair | 0x6B52aBe2414CC0fbff24b5a7d25bC6A37c44Bc31 |
| Froggy Streak (Current) | 0x691ada7728fD5BDC50203d58dA3AbF2BC91c5C41 |

---

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- wagmi v2
- viem v2
- @tanstack/react-query v5
- Framer Motion

---

## Environment Variables

Create `.env.local` in the root:

NEXT_PUBLIC_SEI_RPC_URL="https://evm-rpc.sei-apis.com"
NEXT_PUBLIC_SEI_EXPLORER_BASE_URL="https://seitrace.com"

Notes:
- RPC defaults to Sei public RPC if not set.
- Explorer defaults to Seitrace if not set.
- Contract addresses are defined in `froggyConfig.ts`.

---

## Installation

pnpm install

or

npm install

---

## Development

pnpm dev

App runs at:

http://localhost:3000

---

## Production Build

pnpm build  
pnpm start

---

## Scripts

pnpm dev      # start dev server  
pnpm build    # production build  
pnpm start    # run production build  
pnpm lint     # run ESLint  

---

## Swap Details

- Quotes are debounced to prevent RPC flooding.
- Approvals default to exact amount approval (not unlimited).
- Swap execution routes through DragonSwap router.
- Token decimals defined in `tokenRegistry.ts`.

---

## API Routes

Used to stabilize UI and reduce client-side dependency load.

### /api/sei-price
- Fetches SEI price from Coingecko
- Uses timeout protection
- CDN cached (s-maxage + stale-while-revalidate)

### /api/frog-stats
- Fetches pool data from Dexscreener
- Cached + timeout protected

---

## Security Headers

Configured in `next.config.ts`:

- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- COOP / CORP
- Content Security Policy

If adding new embeds or RPC providers, update CSP accordingly.

---

## Wallet Support

Currently supports injected wallets:
- MetaMask
- Rabby
- Brave
- Other browser-injected wallets

WalletConnect is not enabled.

---

## Deployment

Designed for Vercel.

Required:
- Set environment variables in Vercel dashboard
- Confirm Chain ID 1329
- Use stable RPC endpoint

---

## Directory Structure

src/
  app/                # App Router pages + API routes
  components/         # UI sections (Swap, Liquidity, Dashboard)
  lib/                # Config, chain setup, swap logic
  features/           # Streak normalization logic
public/               # Mascot and gallery assets

---

## License

Add a license file if redistribution is intended.