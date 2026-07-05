import type { CreateNoteDto, Note } from '@/types' 
import { useCallback } from 'react'

// backend default port is 3001 (see backend/src/config/env.ts)
// override by creating frontend/.env with VITE_API_BASE_URL if needed
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"

export interface ListNotesParams {
  q?: string
  page?: number
  pageSize?: number
}

export interface ListNotesResponse {
  notes: Note[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function useNotesApi() {

  // 1. جلب الملاحظات (بحث + pagination من السيرفر، مش فلترة محلية)
  const getAllNotesByUser = useCallback(
    async (token: string | null, params: ListNotesParams = {}): Promise<ListNotesResponse> => {
      const empty: ListNotesResponse = { notes: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }

      if (!token) {
        console.error("No token found")
        return empty
      }

      try {
        const searchParams = new URLSearchParams()
        if (params.q) searchParams.set("q", params.q)
        if (params.page) searchParams.set("page", String(params.page))
        if (params.pageSize) searchParams.set("pageSize", String(params.pageSize))

        const qs = searchParams.toString()
        const response = await fetch(`${API_BASE_URL}/api/notes${qs ? `?${qs}` : ""}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        })

        if (!response.ok) {
          console.error(`Server Error: ${response.status} ${response.statusText}`)
          return empty
        }

        const data = await response.json()
        // الدعم لحالتين: شكل الرد الجديد ({notes, total, ...}) أو أراي قديم مباشر
        if (Array.isArray(data)) {
          return { notes: data, total: data.length, page: 1, pageSize: data.length || 20, totalPages: 1 }
        }
        return {
          notes: data.notes ?? [],
          total: data.total ?? data.notes?.length ?? 0,
          page: data.page ?? 1,
          pageSize: data.pageSize ?? 20,
          totalPages: data.totalPages ?? 1,
        }
      } catch (error) {
        console.error("Network Error - failed to fetch from backend:", error)
        return empty
      }
    },
    []
  )

  // 2. إنشاء ملاحظة جديدة
  const createNote = useCallback(async (note: CreateNoteDto, token: string | null) => {
    if (!token) {
      console.error("No token found")
      return null
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/notes`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`, 
          "Content-Type": "application/json"
        },
        body: JSON.stringify(note)
      })

      if (!response.ok) {
        console.error(`Server Error: ${response.status} ${response.statusText}`)
        return null 
      }

      const data = await response.json()
      return data.note || data
    } catch (error) {
      console.error("Network Error - failed to create note:", error)
      return null
    }
  }, [])

  // 3. جلب ملاحظة واحدة بالتفصيل
  const getNoteById = useCallback(async (id: string, token: string | null) => {
    if (!token || !id) return null;
    try {
      const response = await fetch(`${API_BASE_URL}/api/notes/${id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.note || data;
    } catch (error) {
      console.error("Error fetching note details:", error);
      return null;
    }
  }, []);

  // 4. تحديث ملاحظة موجودة
  const updateNote = useCallback(async (
    id: string,
    updates: Partial<Pick<Note, 'title' | 'content' | 'summary'>>,
    token: string | null
  ) => {
    if (!token || !id) {
      console.error("Missing token or id for update")
      return null
    }
    try {
      // الباك إند بيعرّف الراوت كـ PATCH فقط (backend/src/routes/notes.ts)
      // - PUT كان بيرجع 404/405 دايمًا وده كان بيفشّل أي تحديث بصمت.
      const response = await fetch(`${API_BASE_URL}/api/notes/${id}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        console.error(`Server Error: ${response.status} ${response.statusText}`)
        return null
      }

      const data = await response.json()
      return data.note || data
    } catch (error) {
      console.error("Network Error - failed to update note:", error)
      return null
    }
  }, [])

  // 5. حذف ملاحظة
  const deleteNote = useCallback(async (id: string, token: string | null) => {
    if (!token || !id) {
      console.error("Missing token or id for delete")
      return false
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/notes/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      })
      return response.ok
    } catch (error) {
      console.error("Network Error - failed to delete note:", error)
      return false
    }
  }, [])

  // بنرجع الدوال
  return {
    getAllNotesByUser,
    createNote,
    getNoteById,
    updateNote,
    deleteNote
  }
}

export default useNotesApi