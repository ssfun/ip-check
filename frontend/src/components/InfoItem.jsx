import React from 'react';

export function InfoItem({ label, value }) {
    return (
        <div className="border-b border-gray-100 pb-2 last:border-0">
            <span className="text-sm text-gray-500 block">{label}</span>
            <span className="font-medium text-gray-900">{value || 'N/A'}</span>
        </div>
    );
}
