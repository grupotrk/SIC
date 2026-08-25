import { randomBytes, scryptSync } from 'crypto'

const password = process.argv[2]

if (!password || password.length < 10) {
  console.error('Uso: npm run admin:hash -- "TuPasswordSuperSegura"')
  console.error('Requisito: mínimo 10 caracteres.')
  process.exit(1)
}

const salt = randomBytes(16)
const hash = scryptSync(password, salt, 32)
const encoded = `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`

console.log('ADMIN_PASSWORD_HASH=' + encoded)
