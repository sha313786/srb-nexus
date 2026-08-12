import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface Guild {
  id: string;
  name: string;
  icon: string | null;
}

export const GuildSelector: React.FC = () => {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchGuilds() {
      try {
        const res = await axios.get<{ guilds: Guild[] }>('/api/guilds', {
          withCredentials: true,
        });
        setGuilds(res.data.guilds || []);
      } catch (err) {
        console.error('Failed to load servers', err);
      } finally {
        setLoading(false);
      }
    }
    fetchGuilds();
  }, []);

  if (loading) {
    return <div style={{ color: '#fff', padding: '20px' }}>Loading servers...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', color: '#fff' }}>
      <h1>Select a Server</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
        {guilds.map((guild) => (
          <div
            key={guild.id}
            onClick={() => navigate(`/dashboard/${guild.id}`)}
            style={{
              padding: '15px',
              backgroundColor: '#2f3136',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <h3>{guild.name}</h3>
          </div>
        ))}
      </div>
    </div>
  );
};