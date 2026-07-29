import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import './ProfileCard.css';

export interface ProfileCardProps {
  avatarUrl?: string;
  name?: string;
  title?: string;
  handle?: string;
  status?: string;
  className?: string;
  children?: React.ReactNode;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  avatarUrl = 'https://ui-avatars.com/api/?name=User&background=random',
  className = '',
  name = 'Usuário',
  title = '',
  handle = '',
  status = '',
  children
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = (e: React.MouseEvent) => {
    if (children) {
      e.stopPropagation();
      setIsExpanded(!isExpanded);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--x', `${x}%`);
    card.style.setProperty('--y', `${y}%`);
  };

  return (
    <div className={`pc-wrapper ${className}`.trim()}>
      <div 
        className="pc-card-sober" 
        onClick={toggleExpand}
        onMouseMove={handleMouseMove}
        style={{ cursor: children ? 'pointer' : 'default' }}
      >
        <div className="pc-card-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
            <img
              className="pc-avatar"
              src={avatarUrl}
              alt={name}
              loading="lazy"
              onError={(e) => {
                const t = e.target as HTMLImageElement;
                t.style.display = 'none';
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 className="pc-name">{name}</h3>
                {status && <span className="pc-status-badge">{status}</span>}
              </div>
              <div className="pc-title">{title} {handle && <span className="pc-handle">@{handle}</span>}</div>
            </div>
            
            {children && (
              <div className="pc-chevron" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <ChevronDown size={20} />
              </div>
            )}
          </div>
        </div>
      </div>

      {children && (
        <div className={`pc-accordion ${isExpanded ? 'aberto' : ''}`}>
          <div className="pc-accordion-content">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileCard;
