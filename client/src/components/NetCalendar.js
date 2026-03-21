import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, User, Clock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const NetCalendar = ({ upcomingNets, onDateClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { isDark } = useTheme();

  // Get first day of month and number of days
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

  // Month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Day names
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Navigate months
  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const today = () => {
    setCurrentDate(new Date());
  };

  // Get nets for a specific date
  const getNetsForDate = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return upcomingNets.filter(net => net.date === dateStr);
  };

  // Handle date click
  const handleDateClick = (day, nets) => {
    if (nets.length > 0 && onDateClick) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      onDateClick(dateStr, nets);
    }
  };

  // Get first name from full name
  const getFirstName = (fullName) => {
    if (!fullName) return '';
    return fullName.split(' ')[0];
  };

  // Check if date is today
  const isToday = (day) => {
    const today = new Date();
    return day === today.getDate() && 
           month === today.getMonth() && 
           year === today.getFullYear();
  };

  // Generate calendar days
  const calendarDays = [];
  
  // Empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push({ day: null, nets: [] });
  }
  
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({
      day,
      nets: getNetsForDate(day),
      isToday: isToday(day)
    });
  }

  return (
    <div className="net-calendar">
      {/* Calendar Header */}
      <div className="calendar-header d-flex justify-content-between align-items-center mb-3">
        <button 
          className={`btn btn-sm ${isDark ? 'btn-outline-light' : 'btn-outline-secondary'}`}
          onClick={previousMonth}
        >
          <ChevronLeft size={16} />
        </button>
        <div className="d-flex align-items-center gap-2">
          <h5 className="mb-0">{monthNames[month]} {year}</h5>
          <button 
            className={`btn btn-sm ${isDark ? 'btn-outline-light' : 'btn-outline-primary'}`}
            onClick={today}
          >
            Today
          </button>
        </div>
        <button 
          className={`btn btn-sm ${isDark ? 'btn-outline-light' : 'btn-outline-secondary'}`}
          onClick={nextMonth}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {/* Day headers */}
        <div className="calendar-day-headers">
          {dayNames.map(day => (
            <div key={day} className="calendar-day-header">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="calendar-days">
          {calendarDays.map((dayData, index) => (
            <div
              key={index}
              className={`calendar-day ${dayData.day ? '' : 'empty'} ${dayData.isToday ? 'today' : ''} ${dayData.nets.length > 0 ? 'has-nets' : ''}`}
              onClick={() => dayData.day && handleDateClick(dayData.day, dayData.nets)}
              style={{ cursor: dayData.nets.length > 0 ? 'pointer' : 'default' }}
            >
              {dayData.day && (
                <>
                  <div className="day-number">{dayData.day}</div>
                  <div className="day-nets">
                    {dayData.nets.map((net, netIndex) => (
                      <div
                        key={netIndex}
                        className={`net-item ${net.has_exception ? 'has-exception' : ''}`}
                        title={`${net.schedule_name} - ${net.start_time}${net.assigned_operator ? `\nOperator: ${net.assigned_operator.call_sign.toUpperCase()} ${getFirstName(net.assigned_operator.name)}` : ''}`}
                      >
                        <div className="net-time">
                          <Clock size={10} /> {net.start_time}
                        </div>
                        <div className="net-name">{net.schedule_name}</div>
                        {net.assigned_operator && (
                          <div className="net-operator">
                            <User size={10} /> <span style={{ textTransform: 'uppercase' }}>{net.assigned_operator.call_sign}</span> {getFirstName(net.assigned_operator.name)}
                          </div>
                        )}
                        {net.has_exception && (
                          <div className="net-exception-badge">
                            {net.exception_type === 'cancelled' && '🚫'}
                            {net.exception_type === 'reassigned' && '🔄'}
                            {net.exception_type === 'time_change' && '⏰'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="calendar-legend mt-3">
        <div className="d-flex flex-wrap gap-3 small text-muted">
          <div><span className="legend-box today-box"></span> Today</div>
          <div>🚫 Cancelled</div>
          <div>🔄 Reassigned</div>
          <div>⏰ Time Changed</div>
        </div>
      </div>

      <style jsx>{`
        .net-calendar {
          background: ${isDark ? '#1a1d20' : 'white'};
          border-radius: 8px;
          padding: 20px;
        }

        .calendar-grid {
          border: 1px solid ${isDark ? '#495057' : '#dee2e6'};
          border-radius: 8px;
          overflow: hidden;
        }

        .calendar-day-headers {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          background: ${isDark ? '#2d3238' : '#f8f9fa'};
          border-bottom: 2px solid ${isDark ? '#495057' : '#dee2e6'};
        }

        .calendar-day-header {
          padding: 10px;
          text-align: center;
          font-weight: 600;
          font-size: 0.875rem;
          color: ${isDark ? '#adb5bd' : '#495057'};
        }

        .calendar-days {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 0;
        }

        .calendar-day {
          min-height: 100px;
          border: 1px solid ${isDark ? '#495057' : '#dee2e6'};
          padding: 8px;
          background: ${isDark ? '#212529' : 'white'};
          position: relative;
          transition: background-color 0.2s;
        }

        .calendar-day.has-nets:hover {
          background: ${isDark ? '#2d3238' : '#f8f9fa'};
        }

        .calendar-day.empty {
          background: ${isDark ? '#1a1d20' : '#f8f9fa'};
        }

        .calendar-day.today {
          background: ${isDark ? '#1a3a52' : '#e7f3ff'};
          border: 2px solid #0d6efd;
        }

        .day-number {
          font-weight: 600;
          font-size: 0.875rem;
          color: ${isDark ? '#adb5bd' : '#495057'};
          margin-bottom: 4px;
        }

        .day-nets {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .net-item {
          background: ${isDark ? '#1a3a52' : '#e7f3ff'};
          border-left: 3px solid #0d6efd;
          padding: 4px 6px;
          border-radius: 3px;
          font-size: 0.75rem;
          position: relative;
        }

        .net-item.has-exception {
          background: ${isDark ? '#4a3c1a' : '#fff3cd'};
          border-left-color: #ffc107;
        }

        .net-time {
          display: flex;
          align-items: center;
          gap: 2px;
          color: ${isDark ? '#6ea8fe' : '#0d6efd'};
          font-weight: 600;
          margin-bottom: 2px;
        }

        .net-name {
          color: ${isDark ? '#dee2e6' : '#495057'};
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 2px;
        }

        .net-operator {
          display: flex;
          align-items: center;
          gap: 2px;
          color: ${isDark ? '#adb5bd' : '#6c757d'};
          font-size: 0.7rem;
        }

        .net-exception-badge {
          position: absolute;
          top: 2px;
          right: 2px;
          font-size: 0.7rem;
        }

        .calendar-legend {
          padding-top: 12px;
          border-top: 1px solid ${isDark ? '#495057' : '#dee2e6'};
        }

        .legend-box {
          display: inline-block;
          width: 16px;
          height: 16px;
          border-radius: 3px;
          margin-right: 4px;
          vertical-align: middle;
        }

        .today-box {
          background: ${isDark ? '#1a3a52' : '#e7f3ff'};
          border: 2px solid #0d6efd;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .calendar-day {
            min-height: 80px;
            padding: 4px;
          }

          .day-number {
            font-size: 0.75rem;
          }

          .net-item {
            font-size: 0.65rem;
            padding: 2px 4px;
          }

          .net-time, .net-operator {
            font-size: 0.6rem;
          }

          .calendar-day-header {
            padding: 8px 4px;
            font-size: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
};

export default NetCalendar;
