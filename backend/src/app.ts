import express from 'express'
import { provinceRouter } from './provinces/provinces.routes.js'
import { cityRouter} from './cities/cities.routes.js'

const app = express()
app.use(express.json())

app.use('/api/provinces', provinceRouter)
app.use('/api/cities', cityRouter)

app.use((_, res) => {
  return res.status(404).send({ message: 'Resource not found' })
})

app.listen(3000, () => {
  console.log('Server runnning on http://localhost:3000/')
})