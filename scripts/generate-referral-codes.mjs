import { randomInt } from 'crypto'

const args = process.argv.slice(2)
const count = Number(args[0] || 200)

if (!Number.isInteger(count) || count <= 0) {
  console.error('Uso: npm run ref:generate -- <cantidad> [prefijo]')
  process.exit(1)
}

const requestedPrefix = String(args[1] || '').toUpperCase()
const allowedPrefixes = ['DI', 'DU', 'CT', 'AV']
const prefixes = requestedPrefix && allowedPrefixes.includes(requestedPrefix)
  ? [requestedPrefix]
  : allowedPrefixes

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomBody(len = 4) {
  let out = ''
  for (let i = 0; i < len; i++) {
    out += alphabet[randomInt(0, alphabet.length)]
  }
  return out
}

const generated = new Set()
while (generated.size < count) {
  const p = prefixes[randomInt(0, prefixes.length)]
  generated.add(`TKI-${p}-${randomBody(4)}`)
}

const rows = ['ref_code']
for (const code of generated) {
  rows.push(code)
}

console.log(rows.join('\n'))
