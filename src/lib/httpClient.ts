import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

export type ClientProps = {
  headers: Record<string, string>
}

export class HttpClient {
  private readonly _client: AxiosInstance
  private readonly _headers: Record<string, string>

  constructor({ headers }: ClientProps) {
    this._headers = headers
    this._client = axios.create({
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...this._headers
      }
    })
  }

  async post<T>(
    url: URL,
    params: Record<string, string>,
    config?: AxiosRequestConfig
  ): Promise<{
    response: AxiosResponse
    body: T
  }> {
    return this._client({
      method: 'POST',
      url: url.href,
      data: params,
      ...config
    })
      .then((response) => ({
        response,
        body: response.data
      }))
      .catch((error) => {
        throw new Error(error)
      })
  }
}
