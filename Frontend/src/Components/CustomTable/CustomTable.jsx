// Faisal (C) 6 March 2025
// Faisal (M) 13 March 2025

import React from "react";

const CustomTable = ({
    headerTitle,
    headerButtons,
    body,
    leftDrawer,
    openLeft = false,
    rightDrawer,
    openRight = false,
    pagination,
    footer,
    className,
}) => {
    return (
        <div
            className={`relative bg-[#f7f7f7] ${className?.includes('p-') ? '' : 'p-1'} ${className?.includes('mt-') ? '' : 'mt-2'} overflow-auto ${className || ''}`}
        >
            {/* Header */}
            {(headerTitle || (headerButtons && Array.isArray(headerButtons))) && <div className="flex justify-between bg-white px-2 py-1">
                <h1 className="text-2xl font-medium">{headerTitle && headerTitle}</h1>
                <div className="flex items-center gap-1">
                    {headerButtons &&
                        Array.isArray(headerButtons) &&
                        headerButtons?.map((headerButton, index) => (
                            <span key={headerButton.id || index}>{headerButton}</span>
                        ))
                    }
                </div>
            </div>}
            <div className="flex">
                {/* Left Drawer (if provided) */}
                {leftDrawer && <div className={`${openLeft ? 'w-60' : 'w-0'} overflow-hidden transition-width duration-300 relative`}>{leftDrawer}</div>}

                <div className="flex-1 w-full overflow-auto">
                    {/* Pagination (if provided) */}
                    {pagination && <div className="flex-grow">{pagination}</div>}

                    {/* Table */}
                    <div className="border rounded-sm">
                        {body}
                    </div>

                    {/* Footer (if provided) */}
                    {footer && <div className="flex-grow">{footer}</div>}
                </div>

                {/* Right Drawer (if provided) */}
                {rightDrawer && <div className={`${openRight ? 'w-60' : 'w-0'} overflow-hidden transition-width duration-300`}>{rightDrawer}</div>}
            </div>
        </div>
    );
};

export default CustomTable;
