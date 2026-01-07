import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MobilePagination = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  onItemsPerPageChange,
  totalItems,
  className = ''
}) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = window.innerWidth <= 480 ? 3 : 5;
    
    // Always show first page
    if (totalPages > 1) {
      pages.push(
        <li key={1} className={`page-item ${currentPage === 1 ? 'active' : ''}`}>
          <button 
            className="page-link" 
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
          >
            1
          </button>
        </li>
      );
    }

    // Show ellipsis if needed
    if (currentPage > 3 && totalPages > maxVisiblePages) {
      pages.push(
        <li key="ellipsis1" className="page-item disabled">
          <span className="page-link">...</span>
        </li>
      );
    }

    // Show current page and neighbors
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      if (i !== 1 && i !== totalPages) {
        pages.push(
          <li key={i} className={`page-item ${currentPage === i ? 'active' : ''}`}>
            <button 
              className="page-link" 
              onClick={() => onPageChange(i)}
            >
              {i}
            </button>
          </li>
        );
      }
    }

    // Show ellipsis if needed
    if (currentPage < totalPages - 2 && totalPages > maxVisiblePages) {
      pages.push(
        <li key="ellipsis2" className="page-item disabled">
          <span className="page-link">...</span>
        </li>
      );
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(
        <li key={totalPages} className={`page-item ${currentPage === totalPages ? 'active' : ''}`}>
          <button 
            className="page-link" 
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            {totalPages}
          </button>
        </li>
      );
    }

    return pages;
  };

  return (
    <div className={`d-flex flex-column flex-md-row justify-content-between align-items-center ${className}`}>
      {/* Items info */}
      <div className="mb-2 mb-md-0">
        <small className="text-muted">
          Showing {startItem} to {endItem} of {totalItems} entries
        </small>
      </div>

      {/* Pagination controls */}
      <div className="d-flex flex-column flex-sm-row align-items-center gap-2">
        {/* Items per page selector */}
        <div className="d-flex align-items-center gap-2">
          <small className="text-muted">Show:</small>
          <select
            className="form-control form-control-sm"
            style={{ width: 'auto' }}
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(parseInt(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* Page navigation */}
        {totalPages > 1 && (
          <nav aria-label="Page navigation">
            <ul className="pagination pagination-sm mb-0">
              {/* Previous button */}
              <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                <button
                  className="page-link"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
              </li>

              {/* Page numbers */}
              {renderPageNumbers()}

              {/* Next button */}
              <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                <button
                  className="page-link"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
};

export default MobilePagination;