import { useState, useRef, useEffect, type FormEvent } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { SendHorizontal, Mic, MicOff, FileText, MessageSquare } from "lucide-react"
import { literatureChat } from "../lib/api"
import type { ChatMessage, Document } from "../types/api"
import { cn } from "../lib/utils"

export function LiteraturePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      const audioChunks: BlobPart[] = []

      mediaRecorder.addEventListener("dataavailable", (event) => {
        audioChunks.push(event.data)
      })

      mediaRecorder.addEventListener("stop", () => {
        // TODO: Implement voice-to-text conversion with audioBlob
        setInput("Sample transcribed text from voice input")
        stream.getTracks().forEach((track) => track.stop())
      })

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error("Error accessing microphone:", error)
      setError("Failed to access microphone")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setLoading(true)
    setError(null)
    setInput("")

    try {
      const stream = await literatureChat(input)
      const reader = stream.getReader()
      let content = ""

      // Reset documents for new response
      setDocuments([])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = new TextDecoder().decode(value)
        content += text

        // Extract referenced documents from response
        const matches = text.matchAll(/\[(.*?)\]/g)
        for (const match of matches) {
          const title = match[1]
          if (title && !documents.some((d) => d.title === title)) {
            setDocuments((prev) => [
              ...prev,
              {
                title,
                abstract: "",
                content: "",
                authors: [],
                relevance: Math.random() * 0.3 + 0.7, // Placeholder relevance
              },
            ])
          }
        }

        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1]
          if (lastMsg?.role === "assistant") {
            return [
              ...prev.slice(0, -1),
              {
                ...lastMsg,
                content,
              },
            ]
          }
          return [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content,
              timestamp: new Date().toISOString(),
            },
          ]
        })
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to chat with literature agent"
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Make the header sticky so it's always visible */}
      <header className="sticky top-0 z-50 border-b bg-white/50 backdrop-blur-sm dark:bg-gray-900/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-semibold">Literature Answer Engine</h1>
          </div>
        </div>
      </header>

      {/* Main content scrolls under the sticky header */}
      <main className="container mx-auto px-4 py-6 flex gap-6 flex-1">
        {/* Chat section */}
        <div className="flex flex-col w-full max-w-3xl bg-white dark:bg-gray-900 rounded-xl shadow-sm">
          {/* Message list can scroll if it grows large */}
          <div className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: "60vh" }}>
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                Ask questions about research literature to get started
              </p>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex w-max max-w-[75%] flex-col gap-2 rounded-lg px-3 py-2 text-sm",
                  message.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {message.content}
              </div>
            ))}
            {loading && (
              <div className="chat-message flex justify-start">
                <div className="bg-muted p-3 rounded-xl rounded-tl-none">
                  <div className="typing-indicator flex space-x-1">
                    <span>•</span>
                    <span>•</span>
                    <span>•</span>
                  </div>
                </div>
              </div>
            )}
            {/* Always scroll to bottom */}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar below */}
          <div className="p-4 border-t dark:border-gray-800">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => (isRecording ? stopRecording() : startRecording())}
                className={cn(
                  "p-2 rounded-full transition-colors",
                  isRecording
                    ? "bg-red-100 text-red-600 dark:bg-red-900/30"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                {isRecording ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    handleSubmit(e)
                  }
                }}
                placeholder="Ask about research literature..."
                disabled={loading || isRecording}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={loading || !input.trim() || isRecording}
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <SendHorizontal className="w-4 h-4" />
                )}
              </Button>
            </form>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </div>
        </div>

        {/* Referenced Documents panel */}
        <div className="hidden md:block w-80">
          <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-xl shadow-sm p-4 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Referenced Documents
            </h2>
            {documents.map((doc, index) => (
              <div
                key={index}
                className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow-sm border dark:border-gray-800"
              >
                <h3 className="font-medium">{doc.title}</h3>
                <div className="mt-2 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${doc.relevance * 100}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {Math.round(doc.relevance * 100)}% relevance
                </p>
              </div>
            ))}
            {documents.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No references yet...
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
