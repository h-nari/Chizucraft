import express, { Request, Response } from 'express';
import fetch from 'node-fetch';

const app = express();

app.use(express.static('node_modules/jquery/dist'));
app.use(express.static('node_modules/jquery-confirm/dist'));
app.use(express.static('node_modules/bootstrap/dist'));
app.use(express.static('node_modules/leaflet/dist'));
app.use(express.static('public'));

app.get('/acao', async (req: Request, res: Response) => {
  let url = req.query.url as string;
  console.log('url:', url);
  if (!url) {
    res.send('url required');
  } else {
    try {
      let response = await fetch(url);
      let buf = await response.buffer();
      let headers = response.headers;
      res.set('Content-Type', headers.get('content-type') || 'text/plain');
      res.send(buf);
    } catch (e) {
      console.log('Error:', e);
      res.status(404).send('error');
    }
  }
});

const port = process.env.PORT || 3001;
app.listen(port);
console.log('Express WebApi listenning on port ' + port);