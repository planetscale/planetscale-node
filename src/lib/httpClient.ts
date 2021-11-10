import * as https from 'https'
import type { IncomingMessage } from 'http'

export type ClientProps = {
  headers: Record<string, string>
}

export class HttpClient {
  private readonly _headers: Record<string, string>

  constructor({ headers }: ClientProps) {
    this._headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'planetscale-node/0.2.0',
      ...headers
    }
  }

  private async _executeRequest<T>({ url, body, method }: { url: URL; body: any; method: string }): Promise<{
    response: IncomingMessage
    body: T
  }> {
    const json = JSON.stringify(body)

    const options = {
      method,
      hostname: url.host,
      port: 443,
      path: url.pathname,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': json.length,
        ...this._headers
      }
    }

    return new Promise((resolve, reject) => {
      const req = https.request(options, (response) => {
        let body = ''
        response.on('data', (chunk) => (body += chunk))
        response.on('end', () => resolve({ response, body: JSON.parse(body) }))
      })

      req.on('error', (e) => reject(e))
      req.write(json)
      req.end()
    })
  }

  async post<T>(url: URL, body: any) {
    return this._executeRequest<T>({
      url,
      body,
      method: 'POST'
    })
  }
}
