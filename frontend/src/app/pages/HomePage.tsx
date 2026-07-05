import { GlassCard } from "@/components/common/GlassCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, Loader2 } from "lucide-react"
import { useAuth } from "@clerk/react"
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useIntl } from "react-intl"
import type { Note } from "@/types"
import useNotesApi from "@/hooks/useNotesApi"

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

export function HomePage() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const navigate = useNavigate()
  const intl = useIntl()
  const { getAllNotesByUser } = useNotesApi()

  const [notes, setNotes] = useState<Note[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Debounce the search box so we don't hit the server on every keystroke.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedQuery, setDebouncedQuery] = useState("")

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query)
      setPage(1) // reset pagination whenever the search term changes
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // Fetch notes from the server whenever the debounced query or page changes.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      if (isLoaded && !isSignedIn) setIsInitialLoading(false)
      return
    }

    let cancelled = false

    const fetchNotes = async () => {
      if (page === 1) setIsInitialLoading(true)
      else setIsLoadingMore(true)

      try {
        const token = await getToken()
        if (!token) return

        const result = await getAllNotesByUser(token, {
          q: debouncedQuery || undefined,
          page,
          pageSize: PAGE_SIZE,
        })

        if (cancelled) return

        setTotalPages(result.totalPages)
        setNotes((prev) => (page === 1 ? result.notes : [...prev, ...result.notes]))
      } catch (error) {
        console.error("Error fetching notes:", error)
      } finally {
        if (!cancelled) {
          setIsInitialLoading(false)
          setIsLoadingMore(false)
        }
      }
    }

    fetchNotes()
    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, getToken, getAllNotesByUser, debouncedQuery, page])

  const handleCreateNote = () => {
    navigate(`/notes/new`)
  }

  const handleLoadMore = () => {
    if (page < totalPages) setPage((p) => p + 1)
  }

  const hasResults = notes.length > 0
  const hasSearch = debouncedQuery.trim().length > 0

  return (
    <div className="space-y-12">
      <GlassCard className="flex flex-col px-4 py-6 sm:px-10 gap-4">
        <div className="text-center flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight">
            {intl.formatMessage({ id: "home.myNotes" })}
          </h3>
          <Button className="cursor-pointer" onClick={handleCreateNote}>
            <Plus className="me-2 h-4 w-4" />
            {intl.formatMessage({ id: "home.createNote" })}
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={intl.formatMessage({ id: "home.search" })}
            className="ps-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-col px-4 p-2.5 gap-4.5">
          {isInitialLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : hasResults ? (
            <>
              {notes.map((note) => (
                <GlassCard
                  onClick={() => navigate(`/notes/${note.id || note._id}`)}
                  key={note.id || note._id}
                  className="p-4 cursor-pointer hover:bg-white/50 transition"
                >
                  <h2 className="text-lg font-bold">{note.title}</h2>
                  {note.summary && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {note.summary}
                    </p>
                  )}
                </GlassCard>
              ))}

              {page < totalPages && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    className="cursor-pointer"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      intl.formatMessage({ id: "home.loadMore" })
                    )}
                  </Button>
                </div>
              )}
            </>
          ) : hasSearch ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              {intl.formatMessage({ id: "home.noResults" })}
            </p>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">
              {intl.formatMessage({ id: "home.empty" })}
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  )
}
