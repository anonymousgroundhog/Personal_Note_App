import React, { useState, useMemo } from 'react'
import { X, ChevronLeft, ChevronRight, Clock } from 'lucide-react'

interface DateTimePickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (dateTime: string) => void
  initialValue?: string
  showTime?: boolean // true for datetime, false for date-only
  title?: string
}

export function DateTimePickerModal({
  isOpen,
  onClose,
  onSelect,
  initialValue,
  showTime = false,
  title = 'Select Date' + (showTime ? ' and Time' : '')
}: DateTimePickerModalProps) {
  const now = new Date()
  let initialDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let initialTime = '00:00'

  if (initialValue) {
    const parsed = new Date(initialValue)
    if (!isNaN(parsed.getTime())) {
      initialDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
      if (showTime) {
        const hours = String(parsed.getHours()).padStart(2, '0')
        const minutes = String(parsed.getMinutes()).padStart(2, '0')
        initialTime = `${hours}:${minutes}`
      }
    }
  }

  const [currentMonth, setCurrentMonth] = useState(initialDate)
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [selectedTime, setSelectedTime] = useState(initialTime)

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const firstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const days = useMemo(() => {
    const totalDays = daysInMonth(currentMonth)
    const firstDay = firstDayOfMonth(currentMonth)
    const weeks = []
    let week = Array(firstDay).fill(null)

    for (let day = 1; day <= totalDays; day++) {
      week.push(day)
      if (week.length === 7) {
        weeks.push(week)
        week = []
      }
    }

    if (week.length > 0) {
      weeks.push([...week, ...Array(7 - week.length).fill(null)])
    }

    return weeks
  }, [currentMonth])

  const handleDateClick = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    setSelectedDate(newDate)
  }

  const handleConfirm = () => {
    const year = selectedDate.getFullYear()
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
    const day = String(selectedDate.getDate()).padStart(2, '0')
    let dateString = `${year}-${month}-${day}`

    if (showTime) {
      dateString += `T${selectedTime}:00`
    }

    onSelect(dateString)
    onClose()
  }

  if (!isOpen) return null

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const isSelectedDate = (day: number) => {
    return day &&
      day === selectedDate.getDate() &&
      currentMonth.getMonth() === selectedDate.getMonth() &&
      currentMonth.getFullYear() === selectedDate.getFullYear()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-surface-800 rounded-lg shadow-xl max-w-sm w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          {/* Month/Year Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
            <div className="text-center">
              <p className="font-semibold text-gray-900 dark:text-white">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </p>
            </div>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <ChevronRight size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(day => (
              <div key={day} className="text-center text-xs font-semibold text-gray-600 dark:text-gray-400 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {days.map((week, weekIdx) =>
              week.map((day, dayIdx) => (
                <button
                  key={`${weekIdx}-${dayIdx}`}
                  onClick={() => day && handleDateClick(day)}
                  disabled={!day}
                  className={`p-2 text-sm rounded aspect-square flex items-center justify-center ${
                    !day
                      ? 'text-gray-300 dark:text-gray-700'
                      : isSelectedDate(day)
                      ? 'bg-emerald-500 text-white font-semibold'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {day}
                </button>
              ))
            )}
          </div>

          {/* Time Picker */}
          {showTime && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={18} className="text-gray-600 dark:text-gray-400" />
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Time</label>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-surface-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
          )}

          {/* Selected Date Display */}
          <div className="bg-gray-50 dark:bg-surface-700 p-3 rounded mb-4">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Selected:</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {showTime && ` at ${selectedTime}`}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-surface-700 font-medium text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 font-medium text-sm transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
