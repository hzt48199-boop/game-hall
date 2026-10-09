/* 零依赖静态服务器: node web/serve.js [端口,默认8080] */
const http = require('http'), fs = require('fs'), path = require('path');
const port = +process.argv[2] || +process.env.PORT || 8080, root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.wav': 'audio/wav', '.json': 'application/json', '.png': 'image/png' };
http.createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); return res.end(); }
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(root, path.normalize(p));
  if (!f.startsWith(root) || f.endsWith('serve.js')) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
}).listen(port, () => console.log('web on http://localhost:' + port));
