import { renderToStaticMarkup } from 'react-dom/server.browser'
import App from './src/App.jsx'
const html = renderToStaticMarkup(<App />)
for (const [what, s] of [['case id','PUB-01'],['months line','lightest'],['heaviest','heaviest'],['late-large','large late recharge'],['balance line','Balance'],['run-out','run out'],['recharge today','Recharge today'],['habit compare','Recharge monthly'],['R-16 wording','fixed charge']])
  console.log(html.includes(s) ? 'ok  ' : 'MISS', what, `"${s}"`)
console.log('html length', html.length)
