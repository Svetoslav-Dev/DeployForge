import { buildApp } from './app'

buildApp({ logger: true })
  .then((app) => app.listen({ port: app.config.PORT, host: '0.0.0.0' }))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
