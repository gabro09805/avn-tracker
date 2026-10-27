import { useEffect, useState } from 'react'
import { useScrollLock } from '../hooks/useScrollLock'
import { useForm } from 'react-hook-form'
import { useMutation } from '@apollo/client'
import { X, ArrowLeft, Loader2 } from 'lucide-react'
import { Game, GameInput, GameStatus, DevStatus } from '../types/game'
import { ADD_GAME, IMPORT_FROM_F95, UPDATE_GAME } from '../graphql/mutations'
import { GET_GAMES } from '../graphql/queries'
import { VNDBSearchInline } from './VNDBSearchInline'

interface Props {
  game?: Game | null
  onClose: () => void
}

type FormValues = {
  title: string
  developer: string
  coverUrl: string
  status: GameStatus
  devStatus: DevStatus
  myVersion: string
  latestVersion: string
  downloadUrl: string
  tagsRaw: string
  notes: string
  description: string
  vndbId: string
}

const inputCls = 'w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600 focus:outline-none focus:border-amber-400 dark:focus:border-amber-600 transition-colors'
const labelCls = 'block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1.5 uppercase tracking-wide'

export function GameModal({ game, onClose }: Props) {
  useScrollLock()
  const [tab, setTab] = useState<'manual' | 'vndb' | 'f95'>('manual')
  const [f95Url, setF95Url] = useState('')
  const [f95Error, setF95Error] = useState('')
  const isEdit = !!game

  const { register, handleSubmit, reset, watch, setValue, getValues } = useForm<FormValues>({
    defaultValues: {
      title: '', developer: '', coverUrl: '', status: 'WANT', devStatus: 'ONGOING',
      myVersion: '', latestVersion: '', downloadUrl: '', tagsRaw: '', notes: '', description: '', vndbId: '',
    },
  })

  useEffect(() => {
    if (game) {
      reset({
        title: game.title, developer: game.developer, coverUrl: game.coverUrl,
        status: game.status, devStatus: game.devStatus, myVersion: game.myVersion,
        latestVersion: game.latestVersion, downloadUrl: game.downloadUrl,
        tagsRaw: game.tags.join(', '), notes: game.notes, description: game.description ?? '', vndbId: game.vndbId ?? '',
      })
    }
  }, [game, reset])

  const watchedStatus = watch('status')
  useEffect(() => {
    if (watchedStatus === 'COMPLETED' && !getValues('myVersion')) {
      setValue('myVersion', getValues('latestVersion') || '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedStatus])

  const [addGame] = useMutation(ADD_GAME, { refetchQueries: [GET_GAMES] })
  const [updateGame] = useMutation(UPDATE_GAME, { refetchQueries: [GET_GAMES] })
  const [importFromF95, { loading: importingF95 }] = useMutation(IMPORT_FROM_F95, {
    refetchQueries: [GET_GAMES],
  })

  const onImportFromF95 = async () => {
    const url = f95Url.trim()
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      setF95Error('Enter a valid F95Zone thread URL.')
      return
    }

    if (
      !['http:', 'https:'].includes(parsedUrl.protocol) ||
      !['f95zone.to', 'www.f95zone.to'].includes(parsedUrl.hostname.toLowerCase()) ||
      !/^\/threads\/(?:[^/]*\.)?\d+\/?$/.test(parsedUrl.pathname)
    ) {
      setF95Error('Enter a direct link to an F95Zone thread.')
      return
    }

    setF95Error('')
    try {
      await importFromF95({ variables: { threadUrl: url } })
      onClose()
    } catch (error) {
      setF95Error(error instanceof Error ? error.message : String(error))
    }
  }

  const onSubmit = async (values: FormValues) => {
    const tags = values.tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
    const input: GameInput = {
      title: values.title,
      developer: values.developer || undefined,
      coverUrl: values.coverUrl || undefined,
      status: values.status,
      devStatus: values.devStatus,
      myVersion: values.myVersion || undefined,
      latestVersion: values.latestVersion || undefined,
      downloadUrl: values.downloadUrl || undefined,
      tags,
      notes: values.notes,
      description: values.description,
      vndbId: values.vndbId || undefined,
    }
    if (isEdit) {
      await updateGame({ variables: { id: game.id, input } })
    } else {
      await addGame({ variables: { input } })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 shrink-0">
          <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
            {isEdit ? 'Edit Game' : 'Add Game'}
          </h2>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        {!isEdit && (
          <div className="flex border-b border-stone-100 dark:border-stone-800 shrink-0 px-6">
            {(['manual', 'vndb', 'f95'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-3 mr-6 text-sm font-semibold border-b-2 transition-colors ${
                  tab === t
                    ? 'border-amber-500 text-amber-700 dark:text-amber-400'
                    : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                {t === 'manual' ? 'Manual' : t === 'vndb' ? 'Search VNDB' : 'F95Zone link'}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {!isEdit && tab === 'vndb' ? (
            <VNDBSearchInline onImported={onClose} />
          ) : !isEdit && tab === 'f95' ? (
            <div className="space-y-3">
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Paste a direct link to an F95Zone game thread. Your F95Zone account must be configured in Settings.
              </p>
              <input
                type="url"
                value={f95Url}
                onChange={event => { setF95Url(event.target.value); setF95Error('') }}
                onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void onImportFromF95() } }}
                placeholder="https://f95zone.to/threads/game-name.12345/"
                className={inputCls}
                aria-label="F95Zone thread URL"
              />
              {f95Error && (
                <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{f95Error}</p>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void onImportFromF95()}
                  disabled={importingF95 || !f95Url.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl text-white flex items-center gap-2 text-sm font-semibold transition-colors"
                >
                  {importingF95 && <Loader2 size={15} className="animate-spin" />}
                  {importingF95 ? 'Importing…' : 'Import from F95Zone'}
                </button>
              </div>
            </div>
          ) : (
            <form id="game-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className={labelCls}>Title *</label>
                <input {...register('title', { required: true })} className={inputCls} placeholder="Game title" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Developer</label>
                  <input {...register('developer')} className={inputCls} placeholder="Studio name" />
                </div>
                <div>
                  <label className={labelCls}>VNDB ID</label>
                  <input {...register('vndbId')} className={inputCls} placeholder="v12345" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Cover Image URL</label>
                <input {...register('coverUrl')} className={inputCls} placeholder="https://…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Your Status</label>
                  <select {...register('status')} className={inputCls}>
                    <option value="WANT">Want to Play</option>
                    <option value="PLAYING">Playing</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="DROPPED">Dropped</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Dev Status</label>
                  <select {...register('devStatus')} className={inputCls}>
                    <option value="ONGOING">Ongoing</option>
                    <option value="COMPLETE">Complete</option>
                    <option value="ABANDONED">Abandoned</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
                <div>
                  <label className={labelCls}>Version I Played</label>
                  <input {...register('myVersion')} className={inputCls} placeholder="e.g. 0.9.2" />
                </div>
                <div className="flex items-end pb-1.5">
                  <button
                    type="button"
                    onClick={() => setValue('myVersion', getValues('latestVersion') || '')}
                    className="p-2 rounded-lg text-stone-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                    title="Copy latest version to version played"
                  >
                    <ArrowLeft size={14} />
                  </button>
                </div>
                <div>
                  <label className={labelCls}>Latest Version</label>
                  <input {...register('latestVersion')} className={inputCls} placeholder="e.g. 1.1.0" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Download URL</label>
                <input {...register('downloadUrl')} className={inputCls} placeholder="https://…" />
              </div>
              <div>
                <label className={labelCls}>Tags</label>
                <input {...register('tagsRaw')} className={inputCls} placeholder="RPG, sandbox, romance  (comma-separated)" />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea {...register('description')} rows={4} className={inputCls} placeholder="Game description (auto-filled from VNDB)…" />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea {...register('notes')} rows={3} className={inputCls} placeholder="Personal notes…" />
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {(isEdit || tab === 'manual') && (
          <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-800 flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 font-medium">
              Cancel
            </button>
            <button
              type="submit"
              form="game-form"
              className="px-5 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold transition-colors"
            >
              {isEdit ? 'Save Changes' : 'Add Game'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
