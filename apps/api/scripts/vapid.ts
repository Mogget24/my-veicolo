// Prints a fresh VAPID key pair for Web Push. Put the values in .env (local) and in Vercel env vars.
import webpush from 'web-push'

const { publicKey, privateKey } = webpush.generateVAPIDKeys()
console.log(`VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}`)
