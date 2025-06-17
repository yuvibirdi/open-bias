import { createLazyFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Article } from '@/types'

export const Route = createLazyFileRoute('/articles')({
  component: Articles,
})

function Articles() {
  const [articles, setArticles] = useState<Article[]>([])

  useEffect(() => {
    async function fetchArticles() {
      try {
        const res = await fetch('/api/articles')
        if (!res.ok) {
          throw new Error(`Failed to fetch articles: ${res.statusText}`)
        }
        const data = await res.json()
        setArticles(data.articles)
      } catch (error) {
        console.error('Failed to fetch articles:', error)
      }
    }

    fetchArticles()
  }, [])

  return (
    <div className="p-4">
      <h3 className="text-2xl font-bold mb-4">Articles</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {articles.map((article) => (
          <div key={article.id} className="border rounded-lg p-4">
            <img src={article.imageUrl} alt={article.title} className="w-full h-48 object-cover rounded-md mb-4" />
            <h4 className="font-bold text-lg mb-2">{article.title}</h4>
            <p className="text-sm text-gray-600 mb-4">{article.summary}</p>
            <a href={article.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              Read More
            </a>
          </div>
        ))}
      </div>
    </div>
  )
} 