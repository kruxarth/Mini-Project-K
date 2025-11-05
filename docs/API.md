# 🔌 API Documentation

## Authentication

All API endpoints require authentication via session cookies.

### Login
```http
POST /login
Content-Type: application/x-www-form-urlencoded

email=teacher@example.com&password=password123
```

## Endpoints

### Classes

#### Get Class Summary
```http
GET /api/class/:id/summary?from=2024-01-01&to=2024-01-31
```

**Response:**
```json
{
  "present": 150,
  "absent": 25,
  "late": 10,
  "excused": 5
}
```

#### Get Class Trend
```http
GET /api/class/:id/trend?days=30
```

**Response:**
```json
[
  {
    "date": "2024-01-01",
    "rate": 85
  },
  {
    "date": "2024-01-02",
    "rate": 92
  }
]
```

#### Get Student Percentages
```http
GET /api/class/:id/student-percentages?from=2024-01-01&to=2024-01-31
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "John Doe",
    "roll_no": "001",
    "pct": 95
  }
]
```

### Teacher

#### Get Teacher Totals
```http
GET /api/teacher/totals
```

**Response:**
```json
{
  "classes": 5,
  "students": 150
}
```

#### Get Today's Summary
```http
GET /api/teacher/today
```

**Response:**
```json
{
  "date": "2024-01-15",
  "present": 120,
  "absent": 15,
  "late": 8,
  "excused": 2
}
```

### Students

#### Get Student Heatmap
```http
GET /api/student/:id/heatmap?month=2024-01
```

**Response:**
```json
[
  {
    "date": "2024-01-01",
    "value": 1
  },
  {
    "date": "2024-01-02",
    "value": 0
  }
]
```

### Leaderboard

#### Get Class Leaderboard
```http
GET /api/class/:id/leaderboard?month=2024-01
```

**Response:**
```json
{
  "month": "2024-01",
  "topAttendance": [
    {
      "id": 1,
      "name": "John Doe",
      "roll_no": "001",
      "pct": 98
    }
  ],
  "longestStreak": [
    {
      "id": 1,
      "name": "John Doe",
      "roll_no": "001",
      "streak": 15
    }
  ]
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": "unauthorized"
}
```

### 400 Bad Request
```json
{
  "error": "month required as YYYY-MM"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```