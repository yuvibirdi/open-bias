const base =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000'

export async function api<T> (path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(base + path, init)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}