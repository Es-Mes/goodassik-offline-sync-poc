# 🏗️ Goodassik Production - Project Architecture

> **מדריך מקיף למבנה הפרויקט, ארכיטקטורה, ו-Redux Toolkit implementation**

---

## 📋 תוכן עניינים

1. [סקירה כללית](#סקירה-כללית)
2. [מבנה תיקיות מלא](#מבנה-תיקיות-מלא)
3. [מבנה Frontend מומלץ (Modules)](#-מבנה-frontend-מומלץ-modules)
4. [Packages - הסבר מפורט](#packages---הסבר-מפורט)
5. [Redux Toolkit Architecture](#redux-toolkit-architecture)
6. [Multi-Tenant Architecture](#multi-tenant-architecture)
7. [Sync Architecture](#sync-architecture)
8. [Docker Configuration](#docker-configuration)
9. [Getting Started](#getting-started)

---

## 🎯 סקירה כללית

### מה זה Goodassik?

מערכת ניהול מוסדות חינוך (בתי ספר) עם יכולות offline-first ו-sync אוטומטי.

### טכנולוגיות עיקריות:

- **Frontend**: React + TypeScript + Ant Design
- **State Management**: Redux Toolkit + RTK Query
- **Backend**: Node.js + Express
- **Databases**: SQLite (Local) + PostgreSQL (Cloud)
- **Sync**: Bidirectional sync worker עם conflict resolution
- **Monorepo**: Yarn/npm workspaces

### מאפיינים מרכזיים:

✅ **Offline-First** - עבודה מלאה ללא אינטרנט
✅ **Auto Sync** - סינכרון אוטומטי דו-כיווני
✅ **Conflict Resolution** - Last-Write-Wins עם timestamps
✅ **Multi-Tenant** - תמיכה במספר מוסדות בו-זמנית
✅ **Type-Safe** - TypeScript בכל המערכת
✅ **Tested** - 52 טסטים (28 Unit + 24 Integration)

---

## 🗂️ מבנה תיקיות מלא

```
goodassik-production/
├── packages/
│   ├── shared/                          # 📦 קוד משותף לכל המערכת
│   │   ├── src/
│   │   │   ├── types/                   # TypeScript definitions
│   │   │   │   ├── entities/
│   │   │   │   │   ├── Student.ts
│   │   │   │   │   ├── Class.ts
│   │   │   │   │   ├── Teacher.ts
│   │   │   │   │   ├── Exam.ts
│   │   │   │   │   ├── Scan.ts
│   │   │   │   │   └── Institution.ts
│   │   │   │   ├── sync/
│   │   │   │   │   ├── SyncStatus.ts
│   │   │   │   │   ├── SyncOutbox.ts
│   │   │   │   │   └── CloudSyncOutbox.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── store/                   # Redux store configuration
│   │   │   │   ├── index.ts             # 🔴 Store setup + middleware
│   │   │   │   ├── slices/              # Redux slices (client state)
│   │   │   │   │   ├── authSlice.ts
│   │   │   │   │   ├── uiSlice.ts
│   │   │   │   │   ├── filtersSlice.ts
│   │   │   │   │   └── institutionSlice.ts
│   │   │   │   └── middleware/
│   │   │   │       ├── institutionMiddleware.ts  # Multi-tenant
│   │   │   │       └── syncMiddleware.ts
│   │   │   │
│   │   │   ├── api/                     # RTK Query APIs (server state)
│   │   │   │   ├── baseApi.ts           # Base API configuration
│   │   │   │   ├── studentsApi.ts       # 🔴 Students endpoints
│   │   │   │   ├── classesApi.ts
│   │   │   │   ├── teachersApi.ts
│   │   │   │   ├── examsApi.ts
│   │   │   │   ├── scansApi.ts
│   │   │   │   └── syncApi.ts
│   │   │   │
│   │   │   ├── hooks/                   # Custom hooks
│   │   │   │   ├── redux.ts             # Typed useAppDispatch/Selector
│   │   │   │   ├── useInstitution.ts
│   │   │   │   └── useSync.ts
│   │   │   │
│   │   │   └── utils/                   # Helper functions
│   │   │       ├── dateHelpers.ts
│   │   │       ├── validation.ts
│   │   │       └── conflictResolver.ts
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── web/                             # 🌐 React Frontend
│   │   ├── public/
│   │   │   └── index.html
│   │   │
│   │   ├── src/
│   │   │   ├── main.tsx                 # Entry point
│   │   │   ├── app/                     # Core app shell
│   │   │   │   ├── App.tsx
│   │   │   │   ├── router.tsx
│   │   │   │   ├── store.ts
│   │   │   │   └── providers/
│   │   │   │       └── ReduxProvider.tsx
│   │   │   │
│   │   │   ├── modules/                 # Business modules
│   │   │   │   ├── auth/
│   │   │   │   │   ├── screens/
│   │   │   │   │   ├── components/
│   │   │   │   │   ├── services/
│   │   │   │   │   ├── types.ts
│   │   │   │   │   ├── hooks.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── students/
│   │   │   │   │   ├── screens/
│   │   │   │   │   ├── components/
│   │   │   │   │   ├── services/
│   │   │   │   │   ├── utils/
│   │   │   │   │   ├── types.ts
│   │   │   │   │   ├── hooks.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── classes/
│   │   │   │   ├── exams/
│   │   │   │   ├── scans/
│   │   │   │   ├── operations/
│   │   │   │   ├── reports/
│   │   │   │   ├── users/
│   │   │   │   └── settings/
│   │   │   │
│   │   │   ├── shared/                  # Shared web code
│   │   │   │   ├── components/
│   │   │   │   ├── services/
│   │   │   │   │   └── baseApi.ts
│   │   │   │   ├── store/
│   │   │   │   │   └── slices/
│   │   │   │   │       ├── authSlice.ts
│   │   │   │   │       ├── uiSlice.ts
│   │   │   │   │       └── institutionSlice.ts
│   │   │   │   ├── hooks/
│   │   │   │   ├── types/
│   │   │   │   ├── utils/
│   │   │   │   └── constants/
│   │   │   │
│   │   │   ├── assets/
│   │   │   │   ├── images/
│   │   │   │   ├── icons/
│   │   │   │   └── fonts/
│   │   │   │
│   │   │   └── styles/
│   │   │       ├── global.css
│   │   │       └── theme.ts
│   │   │
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── Dockerfile
│   │
│   ├── local-api/                       # 🗄️ Local SQLite API
│   │   ├── src/
│   │   │   ├── server.js                # Express server
│   │   │   │
│   │   │   ├── database/
│   │   │   │   ├── db.js                # 🔴 SQLite connection
│   │   │   │   └── schema.sql           # DB schema
│   │   │   │
│   │   │   ├── routes/
│   │   │   │   ├── students.ts          # 🔴 CRUD + SyncOutbox
│   │   │   │   ├── classes.ts
│   │   │   │   ├── teachers.ts
│   │   │   │   ├── exams.ts
│   │   │   │   ├── scans.ts
│   │   │   │   └── sync.ts              # Sync status endpoints
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── syncService.js       # SyncOutbox management
│   │   │   │   └── storageService.js    # File storage
│   │   │   │
│   │   │   └── middleware/
│   │   │       ├── errorHandler.js
│   │   │       └── validation.js
│   │   │
│   │   ├── storage/                     # Local file storage
│   │   │   └── scans/
│   │   │
│   │   ├── data/                        # SQLite database files
│   │   │   └── local.db
│   │   │
│   │   ├── tests/                       # Unit tests
│   │   │   ├── scans.test.js
│   │   │   └── package.json
│   │   │
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── cloud-api/                       # ☁️ Cloud PostgreSQL API
│   │   ├── src/
│   │   │   ├── server.js                # Express server
│   │   │   │
│   │   │   ├── database/
│   │   │   │   ├── db.js                # 🔴 PostgreSQL connection
│   │   │   │   └── migrations/
│   │   │   │       └── 001_initial_schema.sql
│   │   │   │
│   │   │   ├── routes/
│   │   │   │   ├── students.ts
│   │   │   │   ├── classes.ts
│   │   │   │   ├── teachers.ts
│   │   │   │   ├── exams.ts
│   │   │   │   ├── scans.ts
│   │   │   │   └── sync.ts              # 🔴 Sync endpoints (receive/send)
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── syncService.js       # CloudSyncOutbox management
│   │   │   │   ├── conflictResolver.js  # Conflict resolution logic
│   │   │   │   └── storageService.js    # Cloud file storage
│   │   │   │
│   │   │   └── middleware/
│   │   │       ├── auth.js              # Multi-tenant auth
│   │   │       ├── errorHandler.js
│   │   │       └── validation.js
│   │   │
│   │   ├── storage/                     # Cloud file storage
│   │   │   └── scans/
│   │   │
│   │   ├── tests/                       # Unit tests
│   │   │   ├── sync.test.js
│   │   │   └── package.json
│   │   │
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   └── sync-worker/                     # 🔄 Bidirectional Sync Service
│       ├── src/
│       │   ├── worker.js                # 🔴 Main sync loop
│       │   │
│       │   ├── database/
│       │   │   └── db.js                # Local DB connection
│       │   │
│       │   ├── services/
│       │   │   ├── pushService.js       # 🔴 Local → Cloud (PUSH)
│       │   │   ├── pullService.js       # 🔴 Cloud → Local (PULL)
│       │   │   ├── conflictResolver.js  # Last-Write-Wins
│       │   │   └── retryService.js      # Retry mechanism
│       │   │
│       │   └── utils/
│       │       ├── logger.js
│       │       └── networkChecker.js
│       │
│       ├── data/                        # SQLite database access
│       ├── package.json
│       └── Dockerfile
│
├── integration-tests/                   # 🧪 Integration tests
│   ├── tests/
│   │   ├── 00-basic-test.test.js
│   │   ├── 01-push-sync.test.js
│   │   ├── 02-pull-sync.test.js
│   │   ├── 03-conflict-resolution.test.js
│   │   ├── 04-batch-sync.test.js
│   │   ├── 05-status-transitions.test.js
│   │   ├── 06-error-scenarios.test.js
│   │   ├── 07-delete-operations.test.js
│   │   └── 08-network-recovery.test.js
│   ├── utils/
│   │   └── test-helpers.js
│   └── package.json
│
├── docker-compose.yml                   # Development environment
├── docker-compose.test.yml              # Test environment
├── docker-compose.prod.yml              # Production environment
│
├── .gitignore
├── package.json                         # Root workspace configuration
├── tsconfig.json                        # Root TypeScript config
├── README.md                            # Main documentation
└── PROJECT-ARCHITECTURE.md              # 📘 This file

```

---

## 🧩 מבנה Frontend מומלץ (Modules)

המבנה שהוצע ע"י ראש הצוות **מתאים מאוד** לפרויקט, והוא ממוקם בתוך [packages/web/src](packages/web/src).

חשוב: זהו מבנה ל-Frontend בלבד. הארכיטקטורה המלאה עדיין כוללת גם [packages/local-api](packages/local-api), [packages/cloud-api](packages/cloud-api), ו-[packages/sync-worker](packages/sync-worker).

### התאמה לצרכים שלנו

- ✅ מתאים ל-Redux Toolkit + RTK Query
- ✅ מתאים ל-Multi-tenant (institution context ב-store וב-services)
- ✅ מתאים להרחבה עתידית לפי מודולים עסקיים
- ✅ מתאים לסביבת Web מלאה (ללא Electron)

### דגשים לשילוב נכון

1. `modules/*/services` אחראי ללוגיקה עסקית של המודול.
2. `shared/services/baseApi.ts` משמש בסיס אחיד לכל קריאות הרשת.
3. `app/providers/ReduxProvider.tsx` מרכז את כל ה-providers הגלובליים.
4. `shared/store/slices` מכיל state גלובלי בלבד; state מודולרי נשאר בתוך המודול.
5. hooks ספציפיים למודול נשארים תחת `modules/<name>/hooks.ts`.

---

## 📦 Packages - הסבר מפורט

### 1️⃣ packages/shared

**תפקיד:** קוד משותף לכל המערכת - types, Redux store, RTK Query APIs

**קבצים מרכזיים:**

#### `store/index.ts` - Redux Store Configuration

```typescript
import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { baseApi } from '../api/baseApi';
import authReducer from './slices/authSlice';
import uiReducer from './slices/uiSlice';
import filtersReducer from './slices/filtersSlice';
import institutionReducer from './slices/institutionSlice';
import { institutionMiddleware } from './middleware/institutionMiddleware';

export const store = configureStore({
  reducer: {
    // RTK Query APIs (server state)
    [baseApi.reducerPath]: baseApi.reducer,
    
    // Redux slices (client state)
    auth: authReducer,
    ui: uiReducer,
    filters: filtersReducer,
    institution: institutionReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(baseApi.middleware)
      .concat(institutionMiddleware), // Multi-tenant support
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

#### `api/studentsApi.ts` - RTK Query API Example

```typescript
import { baseApi } from './baseApi';
import { Student } from '../types/entities/Student';

export const studentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /local/students
    getStudents: builder.query<Student[], { institutionId: number }>({
      query: ({ institutionId }) => ({
        url: '/local/students',
        params: { institutionId },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Student' as const, id })),
              { type: 'Student', id: 'LIST' },
            ]
          : [{ type: 'Student', id: 'LIST' }],
    }),

    // GET /local/students/:id
    getStudent: builder.query<Student, number>({
      query: (id) => `/local/students/${id}`,
      providesTags: (result, error, id) => [{ type: 'Student', id }],
    }),

    // POST /local/students
    addStudent: builder.mutation<Student, Partial<Student>>({
      query: (body) => ({
        url: '/local/students',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Student', id: 'LIST' }],
    }),

    // PATCH /local/students/:id
    updateStudent: builder.mutation<Student, { id: number; data: Partial<Student> }>({
      query: ({ id, data }) => ({
        url: `/local/students/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Student', id }],
    }),

    // DELETE /local/students/:id
    deleteStudent: builder.mutation<void, number>({
      query: (id) => ({
        url: `/local/students/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Student', id }],
    }),
  }),
});

export const {
  useGetStudentsQuery,
  useGetStudentQuery,
  useAddStudentMutation,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
} = studentsApi;
```

#### `types/entities/Student.ts` - TypeScript Types

```typescript
export interface Student {
  id: number;
  institutionId: number;
  firstName: string;
  lastName: string;
  idNumber: string;
  classId: number;
  dateOfBirth: string;
  address?: string;
  phone?: string;
  email?: string;
  parentName?: string;
  parentPhone?: string;
  notes?: string;
  createdAt: string;
  lastModifiedAt: string;
}

export interface StudentFilters {
  search?: string;
  classId?: number;
  sortBy?: 'firstName' | 'lastName' | 'idNumber';
  sortOrder?: 'asc' | 'desc';
}
```

---

### 2️⃣ packages/web

**תפקיד:** React Frontend עם Redux Toolkit

**קבצים מרכזיים:**

#### `main.tsx` - Entry Point

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import heIL from 'antd/locale/he_IL';
import { store } from '@goodassik/shared/store';
import App from './App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ConfigProvider locale={heIL} direction="rtl">
          <App />
        </ConfigProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
```

#### `pages/students/index.tsx` - Students Page

```typescript
import React, { useState } from 'react';
import { Table, Button, Space, Input, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useGetStudentsQuery, useDeleteStudentMutation } from '@goodassik/shared/api/studentsApi';
import { useAppSelector } from '@goodassik/shared/hooks/redux';
import StudentForm from './StudentForm';

export const StudentsPage: React.FC = () => {
  const institutionId = useAppSelector((state) => state.institution.currentId);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);

  // RTK Query hooks
  const { data: students, isLoading, error } = useGetStudentsQuery({ institutionId });
  const [deleteStudent] = useDeleteStudentMutation();

  const handleDelete = async (id: number) => {
    try {
      await deleteStudent(id).unwrap();
      message.success('התלמיד נמחק בהצלחה');
    } catch (error) {
      message.error('שגיאה במחיקת התלמיד');
    }
  };

  const filteredStudents = students?.filter((s) =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { title: 'שם פרטי', dataIndex: 'firstName', key: 'firstName' },
    { title: 'שם משפחה', dataIndex: 'lastName', key: 'lastName' },
    { title: 'ת.ז', dataIndex: 'idNumber', key: 'idNumber' },
    { title: 'כיתה', dataIndex: 'className', key: 'className' },
    {
      title: 'פעולות',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => setEditingStudent(record)} />
          <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsFormOpen(true)}>
          תלמיד חדש
        </Button>
        <Input.Search
          placeholder="חיפוש תלמיד..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 300 }}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={filteredStudents}
        loading={isLoading}
        rowKey="id"
      />

      <StudentForm
        open={isFormOpen}
        student={editingStudent}
        onClose={() => {
          setIsFormOpen(false);
          setEditingStudent(null);
        }}
      />
    </div>
  );
};
```

---

### 3️⃣ packages/local-api

**תפקיד:** Local REST API עם SQLite

**קבצים מרכזיים:**

#### `routes/students.ts` - CRUD with SyncOutbox

```javascript
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { createSyncOutboxEntry } = require('../services/syncService');

// POST /local/students - Create
router.post('/', (req, res) => {
  const { institutionId, firstName, lastName, idNumber, classId } = req.body;
  
  if (!firstName || !lastName || !idNumber) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO Students (InstitutionId, FirstName, LastName, IdNumber, ClassId, CreatedAt, LastModifiedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(institutionId, firstName, lastName, idNumber, classId, now, now);
  const studentId = result.lastInsertRowid;

  // ✅ Create SyncOutbox entry for Cloud
  createSyncOutboxEntry('Student', studentId, 'Create');

  res.json({ success: true, id: studentId });
});

// PATCH /local/students/:id - Update
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, phone, email, notes } = req.body;
  
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE Students 
    SET FirstName = COALESCE(?, FirstName),
        LastName = COALESCE(?, LastName),
        Phone = ?,
        Email = ?,
        Notes = ?,
        LastModifiedAt = ?
    WHERE Id = ?
  `);
  
  stmt.run(firstName, lastName, phone, email, notes, now, id);

  // ✅ Create SyncOutbox entry for update
  createSyncOutboxEntry('Student', id, 'Update');

  res.json({ success: true });
});

// DELETE /local/students/:id - Delete
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  const stmt = db.prepare('DELETE FROM Students WHERE Id = ?');
  const result = stmt.run(id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Student not found' });
  }

  // ✅ Create SyncOutbox entry for deletion
  createSyncOutboxEntry('Student', id, 'Delete');

  res.json({ success: true });
});

module.exports = router;
```

#### `services/syncService.js` - SyncOutbox Management

```javascript
const db = require('../database/db');

function createSyncOutboxEntry(entityType, entityId, action) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO SyncOutbox (EntityType, EntityId, Action, Status, CreatedAt)
    VALUES (?, ?, ?, 'Pending', ?)
  `);
  
  stmt.run(entityType, entityId, action, now);
}

function getSyncStatus() {
  const stmt = db.prepare(`
    SELECT Status, COUNT(*) as count
    FROM SyncOutbox
    GROUP BY Status
  `);
  
  return stmt.all();
}

module.exports = {
  createSyncOutboxEntry,
  getSyncStatus,
};
```

---

### 4️⃣ packages/cloud-api

**תפקיד:** Cloud REST API עם PostgreSQL

**קבצים מרכזיים:**

#### `routes/sync.ts` - Sync Endpoints

```javascript
const express = require('express');
const router = express.Router();
const db = require('../database/db');

// POST /api/sync/students - Receive from Local
router.post('/students', async (req, res) => {
  const { studentId, institutionId, firstName, lastName, idNumber, classId, createdAt, lastModifiedAt } = req.body;

  // Check if already synced (idempotency)
  const existing = await db.query('SELECT id FROM students WHERE id = $1', [studentId]);
  if (existing.rows.length > 0) {
    return res.json({ success: true, message: 'Already synced' });
  }

  // Insert into Cloud DB
  await db.query(`
    INSERT INTO students (id, institutionid, firstname, lastname, idnumber, classid, createdat, lastmodifiedat)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [studentId, institutionId, firstName, lastName, idNumber, classId, createdAt, lastModifiedAt]);

  res.json({ success: true });
});

// PATCH /api/sync/students/:id - Update in Cloud
router.patch('/students/:id', async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, phone, email, notes } = req.body;
  
  const now = new Date().toISOString();
  await db.query(`
    UPDATE students
    SET firstname = COALESCE($1, firstname),
        lastname = COALESCE($2, lastname),
        phone = $3,
        email = $4,
        notes = $5,
        lastmodifiedat = $6
    WHERE id = $7
  `, [firstName, lastName, phone, email, notes, now, id]);

  // ✅ Create CloudSyncOutbox entry for Local to pull
  await db.query(`
    INSERT INTO cloudsyncoutbox (entitytype, entityid, action, status, createdat, data)
    VALUES ('Student', $1, 'Update', 'Pending', $2, $3)
  `, [id, now, JSON.stringify({ firstName, lastName, phone, email, notes, lastModifiedAt: now })]);

  res.json({ success: true });
});

// GET /api/sync/updates - Get pending updates for Local
router.get('/updates', async (req, res) => {
  const result = await db.query(`
    SELECT id, entitytype, entityid, action, data, createdat
    FROM cloudsyncoutbox
    WHERE status = 'Pending'
    ORDER BY createdat ASC
  `);

  res.json({ updates: result.rows });
});

// POST /api/sync/updates/:id/complete - Mark update as completed
router.post('/updates/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'Synced' | 'Overridden' | 'Skipped' | 'Failed'

  await db.query('UPDATE cloudsyncoutbox SET status = $1 WHERE id = $2', [status, id]);

  res.json({ success: true });
});

module.exports = router;
```

---

### 5️⃣ packages/sync-worker

**תפקיד:** Bidirectional Sync Service

**קבצים מרכזיים:**

#### `worker.js` - Main Sync Loop

```javascript
const { pushToCloud } = require('./services/pushService');
const { pullFromCloud } = require('./services/pullService');

const SYNC_INTERVAL = process.env.SYNC_INTERVAL || 30000; // 30 seconds

async function syncLoop() {
  console.log('🔄 Starting sync cycle...');

  try {
    // PUSH: Local → Cloud
    await pushToCloud();

    // PULL: Cloud → Local
    await pullFromCloud();

    console.log('✅ Sync cycle completed');
  } catch (error) {
    console.error('❌ Sync cycle failed:', error.message);
  }
}

// Start sync worker
console.log('🚀 Sync Worker started');
setInterval(syncLoop, SYNC_INTERVAL);
syncLoop(); // Run immediately
```

#### `services/pushService.js` - PUSH (Local → Cloud)

```javascript
const axios = require('axios');
const db = require('../database/db');

async function pushToCloud() {
  const outbox = db.prepare(`
    SELECT * FROM SyncOutbox
    WHERE Status = 'Pending'
    ORDER BY CreatedAt ASC
  `).all();

  for (const entry of outbox) {
    try {
      // Update status to InProgress
      updateStatus(entry.Id, 'InProgress');

      // Check if entry is outdated (Skipped)
      if (isOutdated(entry)) {
        updateStatus(entry.Id, 'Skipped');
        continue;
      }

      // Get entity data
      const entity = getEntity(entry.EntityType, entry.EntityId);
      if (!entity) {
        updateStatus(entry.Id, 'Skipped');
        continue;
      }

      // Send to Cloud API
      const url = `${process.env.CLOUD_API_URL}/api/sync/${entry.EntityType.toLowerCase()}s`;
      const response = await axios.post(url, entity);

      // Mark as Synced
      updateStatus(entry.Id, 'Synced');
    } catch (error) {
      console.error(`Failed to push ${entry.EntityType} ${entry.EntityId}:`, error.message);
      updateStatus(entry.Id, 'Failed');
    }
  }
}

function isOutdated(entry) {
  const entity = getEntity(entry.EntityType, entry.EntityId);
  if (!entity) return true;

  const outboxTime = new Date(entry.CreatedAt).getTime();
  const entityTime = new Date(entity.LastModifiedAt || entity.CreatedAt).getTime();
  
  return outboxTime < entityTime;
}

function updateStatus(id, status) {
  db.prepare('UPDATE SyncOutbox SET Status = ? WHERE Id = ?').run(status, id);
}

module.exports = { pushToCloud };
```

#### `services/pullService.js` - PULL (Cloud → Local)

```javascript
const axios = require('axios');
const db = require('../database/db');
const { resolveConflict } = require('./conflictResolver');

async function pullFromCloud() {
  // Get pending updates from Cloud
  const response = await axios.get(`${process.env.CLOUD_API_URL}/api/sync/updates`);
  const updates = response.data.updates;

  for (const update of updates) {
    try {
      // Check for conflict
      const localEntity = getEntity(update.entitytype, update.entityid);
      const localPending = hasPendingChanges(update.entitytype, update.entityid);

      if (localPending) {
        // Conflict detected - resolve with Last-Write-Wins
        const winner = resolveConflict(localEntity, update.data);
        
        if (winner === 'cloud') {
          // Cloud wins - apply update + mark local as Overridden
          applyUpdate(update);
          markLocalAsOverridden(update.entitytype, update.entityid);
          markCloudUpdate(update.id, 'Overridden');
        } else {
          // Local wins - skip cloud update
          markCloudUpdate(update.id, 'Skipped');
        }
      } else {
        // No conflict - apply update
        applyUpdate(update);
        markCloudUpdate(update.id, 'Synced');
      }
    } catch (error) {
      console.error(`Failed to pull update ${update.id}:`, error.message);
      markCloudUpdate(update.id, 'Failed');
    }
  }
}

function applyUpdate(update) {
  const data = JSON.parse(update.data);
  const table = update.entitytype + 's'; // Student → Students
  
  const fields = Object.keys(data).join(', ');
  const values = Object.values(data);
  
  db.prepare(`UPDATE ${table} SET ${fields} WHERE Id = ?`).run(...values, update.entityid);
}

async function markCloudUpdate(id, status) {
  await axios.post(
    `${process.env.CLOUD_API_URL}/api/sync/updates/${id}/complete`,
    { status }
  );
}

module.exports = { pullFromCloud };
```

#### `services/conflictResolver.js` - Last-Write-Wins

```javascript
function resolveConflict(localEntity, cloudData) {
  const localTime = new Date(localEntity.LastModifiedAt).getTime();
  const cloudTime = new Date(cloudData.lastModifiedAt).getTime();

  if (cloudTime > localTime) {
    console.log(`⚔️ Conflict: Cloud wins (${cloudTime} > ${localTime})`);
    return 'cloud';
  } else {
    console.log(`⚔️ Conflict: Local wins (${localTime} >= ${cloudTime})`);
    return 'local';
  }
}

module.exports = { resolveConflict };
```

---

## 🔴 Redux Toolkit Architecture

### State Management Strategy

**Redux Toolkit + RTK Query:**
- ✅ **RTK Query** - Server state (API calls, caching, loading states)
- ✅ **Redux Slices** - Client state (UI, filters, selections)
- ✅ **Clear Separation** - API logic ≠ UI logic

### RTK Query Benefits:

1. **Automatic Caching** - אוטומטי cache של responses
2. **Auto Refetch** - רענון אוטומטי כשצריך
3. **Loading States** - `isLoading`, `isFetching` built-in
4. **Optimistic Updates** - עדכון UI לפני תשובה מהשרת
5. **Tag Invalidation** - רענון ממוקד של queries

### Example Flow:

```typescript
// ✅ Component uses hook
const { data: students, isLoading } = useGetStudentsQuery({ institutionId: 1 });

// ✅ Behind the scenes:
// 1. RTK Query checks cache
// 2. If cache hit → return immediately
// 3. If cache miss → fetch from API
// 4. Store in cache with tag ['Student', 'LIST']
// 5. Return data + loading state to component

// ✅ When student is updated:
const [updateStudent] = useUpdateStudentMutation();
await updateStudent({ id: 5, data: { firstName: 'John' } });

// ✅ RTK Query automatically:
// 1. Sends PATCH request
// 2. Invalidates tag ['Student', id: 5]
// 3. Refetches affected queries
// 4. Updates UI automatically
```

---

## 🏢 Multi-Tenant Architecture

### מטרה:

תמיכה במספר מוסדות (בתי ספר) בו-זמנית עם הפרדת נתונים מוחלטת.

### אסטרטגיה:

**Single Database + InstitutionId:**
- כל טבלה מכילה `InstitutionId`
- Middleware מוסיף אוטומטית `InstitutionId` לכל query
- Frontend מציג מתג בין מוסדות

### Implementation:

#### Institution Middleware

```typescript
// packages/shared/store/middleware/institutionMiddleware.ts
import { Middleware } from '@reduxjs/toolkit';

export const institutionMiddleware: Middleware = (store) => (next) => (action) => {
  const state = store.getState();
  const currentInstitutionId = state.institution.currentId;

  // Auto-inject institutionId into RTK Query requests
  if (action.type?.startsWith('studentsApi/')) {
    if (action.meta?.arg?.originalArgs) {
      action.meta.arg.originalArgs.institutionId = currentInstitutionId;
    }
  }

  return next(action);
};
```

#### Institution Slice

```typescript
// packages/shared/store/slices/institutionSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface InstitutionState {
  currentId: number;
  institutions: Array<{ id: number; name: string }>;
}

const initialState: InstitutionState = {
  currentId: 1,
  institutions: [],
};

const institutionSlice = createSlice({
  name: 'institution',
  initialState,
  reducers: {
    setCurrentInstitution: (state, action: PayloadAction<number>) => {
      state.currentId = action.payload;
    },
    setInstitutions: (state, action) => {
      state.institutions = action.payload;
    },
  },
});

export const { setCurrentInstitution, setInstitutions } = institutionSlice.actions;
export default institutionSlice.reducer;
```

#### Institution Switcher Component

```typescript
// packages/web/src/components/institution/InstitutionSwitcher.tsx
import React from 'react';
import { Select } from 'antd';
import { useAppDispatch, useAppSelector } from '@goodassik/shared/hooks/redux';
import { setCurrentInstitution } from '@goodassik/shared/store/slices/institutionSlice';

export const InstitutionSwitcher: React.FC = () => {
  const dispatch = useAppDispatch();
  const { currentId, institutions } = useAppSelector((state) => state.institution);

  const handleChange = (institutionId: number) => {
    dispatch(setCurrentInstitution(institutionId));
    // RTK Query will automatically refetch with new institutionId
  };

  return (
    <Select
      value={currentId}
      onChange={handleChange}
      style={{ width: 200 }}
      options={institutions.map((inst) => ({
        label: inst.name,
        value: inst.id,
      }))}
    />
  );
};
```

### Database Schema:

```sql
-- All tables have InstitutionId
CREATE TABLE Students (
  Id INTEGER PRIMARY KEY,
  InstitutionId INTEGER NOT NULL,
  FirstName TEXT NOT NULL,
  LastName TEXT NOT NULL,
  -- ... other fields
  FOREIGN KEY (InstitutionId) REFERENCES Institutions(Id)
);

CREATE INDEX idx_students_institution ON Students(InstitutionId);
```

---

## 🔄 Sync Architecture

### Sync Flow Diagram:

```
┌─────────────┐                    ┌─────────────┐
│  Local API  │                    │  Cloud API  │
│  (SQLite)   │                    │(PostgreSQL) │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │ 1. User creates student          │
       │ → INSERT INTO Students           │
       │ → INSERT INTO SyncOutbox         │
       │   (Status: Pending)              │
       │                                  │
       ▼                                  │
┌──────────────────────────────────────┐ │
│         Sync Worker                   │ │
│  (Runs every 30 seconds)              │ │
└──────────────────────────────────────┘ │
       │                                  │
       │ 2. PUSH: Get pending entries     │
       │ ← SELECT * FROM SyncOutbox       │
       │   WHERE Status = 'Pending'       │
       │                                  │
       │ 3. Send to Cloud ────────────────┼──►
       │   POST /api/sync/students        │
       │                                  │ INSERT INTO students
       │                                  │ (idempotency check)
       │                                  │
       │ 4. Mark as Synced                │
       │ → UPDATE SyncOutbox              │
       │   SET Status = 'Synced'          │
       │                                  │
       │                                  │ 5. Cloud update
       │                                  │ → UPDATE students
       │                                  │ → INSERT INTO CloudSyncOutbox
       │                                  │   (Status: Pending)
       │                                  │
       │ 6. PULL: Get updates ────────────┼──◄ GET /api/sync/updates
       │   ← SELECT * FROM CloudSyncOutbox│   WHERE Status = 'Pending'
       │                                  │
       │ 7. Check conflicts               │
       │    Compare timestamps            │
       │    Last-Write-Wins               │
       │                                  │
       │ 8. Apply update                  │
       │ → UPDATE Students                │
       │                                  │
       │ 9. Notify Cloud ─────────────────┼──► POST /api/sync/updates/:id/complete
       │                                  │   { status: 'Synced' }
       │                                  │
       │                                  │ → UPDATE CloudSyncOutbox
       │                                  │   SET Status = 'Synced'
```

### Sync Statuses:

#### Local SyncOutbox (6 סטטוסים):
1. **Pending** - ממתין לסינכרון
2. **InProgress** - בתהליך סינכרון
3. **Synced** - סונכרן בהצלחה
4. **Failed** - נכשל (retry אוטומטי)
5. **Overridden** - נדרס על ידי עדכון מהענן
6. **Skipped** - מיושן (נוצר לפני שהEntity עודכן)

#### CloudSyncOutbox (5 סטטוסים):
1. **Pending** - ממתין להורדה לLocal
2. **Synced** - הורד והוחל בהצלחה
3. **Failed** - נכשל בהחלה
4. **Overridden** - הענן ניצח בקונפליקט
5. **Skipped** - Local יותר עדכני

### Conflict Resolution - Last-Write-Wins:

```javascript
// Compare timestamps
const localTime = new Date(localEntity.LastModifiedAt).getTime();
const cloudTime = new Date(cloudUpdate.lastModifiedAt).getTime();

if (cloudTime > localTime) {
  // Cloud wins
  applyCloudUpdate();
  markLocalAsOverridden();
} else {
  // Local wins
  skipCloudUpdate();
  pushLocalToCloud();
}
```

---

## 🐳 Docker Configuration

### Development Environment

#### `docker-compose.yml`

```yaml
version: '3.8'

services:
  local-api:
    build: ./packages/local-api
    ports:
      - "3001:3001"
    volumes:
      - ./packages/local-api/src:/app/src
      - ./packages/local-api/data:/app/data
      - ./packages/local-api/storage:/app/storage
    environment:
      - NODE_ENV=development
      - PORT=3001

  cloud-api:
    build: ./packages/cloud-api
    ports:
      - "3002:3002"
    volumes:
      - ./packages/cloud-api/src:/app/src
      - ./packages/cloud-api/storage:/app/storage
    environment:
      - NODE_ENV=development
      - PORT=3002
      - DB_HOST=cloud-db
      - DB_PORT=5432
      - DB_NAME=goodassik
      - DB_USER=postgres
      - DB_PASSWORD=postgres
    depends_on:
      - cloud-db

  cloud-db:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=goodassik
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres

  sync-worker:
    build: ./packages/sync-worker
    volumes:
      - ./packages/sync-worker/src:/app/src
      - ./packages/local-api/data:/app/data
    environment:
      - NODE_ENV=development
      - LOCAL_API_URL=http://local-api:3001
      - CLOUD_API_URL=http://cloud-api:3002
      - SYNC_INTERVAL=30000
    depends_on:
      - local-api
      - cloud-api

  web:
    build: ./packages/web
    ports:
      - "5173:5173"
    volumes:
      - ./packages/web/src:/app/src
    environment:
      - NODE_ENV=development
      - VITE_LOCAL_API_URL=http://localhost:3001
      - VITE_CLOUD_API_URL=http://localhost:3002

volumes:
  postgres-data:
```

### Test Environment

#### `docker-compose.test.yml`

```yaml
version: '3.8'

services:
  test-local-api:
    build: ./packages/local-api
    ports:
      - "3011:3001"
    environment:
      - NODE_ENV=test
      - PORT=3001

  test-cloud-api:
    build: ./packages/cloud-api
    ports:
      - "3012:3002"
    environment:
      - NODE_ENV=test
      - PORT=3002
      - DB_HOST=test-cloud-db
      - DB_NAME=test_db
    depends_on:
      - test-cloud-db

  test-cloud-db:
    image: postgres:15-alpine
    ports:
      - "5433:5432"
    environment:
      - POSTGRES_DB=test_db
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres

  test-sync-worker:
    build: ./packages/sync-worker
    environment:
      - NODE_ENV=test
      - SYNC_INTERVAL=5000  # 5 seconds for fast testing
      - LOCAL_API_URL=http://test-local-api:3001
      - CLOUD_API_URL=http://test-cloud-api:3002
    depends_on:
      - test-local-api
      - test-cloud-api
```

---

## 🚀 Getting Started

### Prerequisites:

- Node.js 18+
- Docker & Docker Compose
- Git

### Installation:

```powershell
# Clone repository
git clone https://github.com/your-org/goodassik-production.git
cd goodassik-production

# Install dependencies (all packages)
npm install

# Build shared package
cd packages/shared
npm run build
cd ../..

# Start development environment
docker-compose up -d

# Access:
# - Frontend: http://localhost:5173
# - Local API: http://localhost:3001
# - Cloud API: http://localhost:3002
```

### Running Tests:

```powershell
# Unit/API Tests
cd packages/local-api/tests
npm test

cd packages/cloud-api/tests
npm test

# Integration Tests
cd integration-tests
npm test
```

### Development Workflow:

1. **Start services:**
   ```powershell
   docker-compose up -d
   ```

2. **Watch logs:**
   ```powershell
   docker-compose logs -f sync-worker
   ```

3. **Rebuild after changes:**
   ```powershell
   docker-compose up -d --build
   ```

4. **Stop services:**
   ```powershell
   docker-compose down
   ```

---

## 📊 Test Coverage

### Unit/API Tests: 28 טסטים ✅
- Local API: 15 tests
- Cloud API: 13 tests
- Coverage: ~85%

### Integration Tests: 24 טסטים ✅
- Basic sync: 1 test
- Push sync: 2 tests
- Pull sync: 2 tests
- Conflict resolution: 2 tests
- Batch sync: 2 tests
- Status transitions: 3 tests
- Error scenarios: 5 tests
- Delete operations: 4 tests
- Network recovery: 3 tests

**סה"כ: 52 טסטים - 100% Pass Rate**

---

## 🎓 למה Redux Toolkit?

### יתרונות לצוות:

1. ✅ **הצוות כבר מכיר** - ניסיון קיים עם Redux
2. ✅ **Multi-tenant מובנה** - Middleware לניהול מוסדות
3. ✅ **הפרדה ברורה** - Server state (RTK Query) vs Client state (Redux slices)
4. ✅ **TypeScript מצוין** - Typed hooks ו-selectors
5. ✅ **DevTools חזקים** - Redux DevTools לדיבוג

### למה לא React Query + Jotai?

- ❌ מיגרציה לא הושלמה (hybrid state)
- ❌ Multi-tenant מורכב יותר
- ❌ Middleware פחות טבעי
- ❌ למידה של 2 ספריות (React Query + Jotai)

---

## 📚 מסמכים נוספים

- [TESTING.md](./TESTING.md) - מדריך הטסטים המלא
- [TESTS-GUIDE.md](./TESTS-GUIDE.md) - רשימת כל 52 הטסטים
- [README.md](./README.md) - Getting Started בסיסי

---

## 🤝 Contributing

כדי לתרום לפרויקט:

1. צור branch חדש: `git checkout -b feature/my-feature`
2. כתוב tests
3. הרץ `npm test` לוודא שהכל עובד
4. פתח Pull Request

---

## 📞 צור קשר

לשאלות ותמיכה: [your-email@example.com](mailto:your-email@example.com)

---

**🎉 Good Luck with Goodassik Production! 🚀**

*Last updated: June 2026*
