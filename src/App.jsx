
import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_BASE_URL

export default function App() {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(API + "/locations")
      .then(r => r.json())
      .then(d => {
        setLocations(d)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'Arial',
      maxWidth: '500px',
      margin: '0 auto'
    }}>
      <h2>📍 Locations</h2>

      {loading && <p>Loading...</p>}

      {!loading && locations.map(loc => (
        <div key={loc.id} style={{
          padding: '12px',
          border: '1px solid #ccc',
          borderRadius: '8px',
          marginBottom: '10px'
        }}>
          <strong>{loc.name}</strong>
        </div>
      ))}
    </div>
  )
}
