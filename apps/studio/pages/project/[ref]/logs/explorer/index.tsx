import { useParams } from 'common/hooks'
import dayjs from 'dayjs'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

import LogTable from 'components/interfaces/Settings/Logs/LogTable'
import {
  LOGS_LARGE_DATE_RANGE_DAYS_THRESHOLD,
  LogsTableName,
  TEMPLATES,
} from 'components/interfaces/Settings/Logs/Logs.constants'
import type {
  DatePickerToFrom,
  LogTemplate,
  LogsWarning,
} from 'components/interfaces/Settings/Logs/Logs.types'
import {
  maybeShowUpgradePrompt,
  useEditorHints,
} from 'components/interfaces/Settings/Logs/Logs.utils'
import LogsQueryPanel from 'components/interfaces/Settings/Logs/LogsQueryPanel'
import UpgradePrompt from 'components/interfaces/Settings/Logs/UpgradePrompt'
import LogsLayout from 'components/layouts/LogsLayout/LogsLayout'
import CodeEditor from 'components/ui/CodeEditor/CodeEditor'
import LoadingOpacity from 'components/ui/LoadingOpacity'
import ShimmerLine from 'components/ui/ShimmerLine'
import { useContentInsertMutation } from 'data/content/content-insert-mutation'
import { useOrgSubscriptionQuery } from 'data/subscriptions/org-subscription-query'
import useLogsQuery from 'hooks/analytics/useLogsQuery'
import { useLocalStorage } from 'hooks/misc/useLocalStorage'
import { useSelectedOrganization } from 'hooks/misc/useSelectedOrganization'
import { useUpgradePrompt } from 'hooks/misc/useUpgradePrompt'
import { LOCAL_STORAGE_KEYS } from 'lib/constants'
import { uuidv4 } from 'lib/helpers'
import type { LogSqlSnippets, NextPageWithLayout } from 'types'
import {
  Button,
  Form,
  Input,
  Modal,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from 'ui'

const PLACEHOLDER_QUERY =
  'select\n  cast(timestamp as datetime) as timestamp,\n  event_message, metadata \nfrom edge_logs \nlimit 5'

export const LogsExplorerPage: NextPageWithLayout = () => {
  useEditorHints()
  const router = useRouter()
  const { ref: projectRef, q, ite, its } = useParams()
  const organization = useSelectedOrganization()
  const [editorId, setEditorId] = useState<string>(uuidv4())
  const [editorValue, setEditorValue] = useState<string>(PLACEHOLDER_QUERY)
  const [saveModalOpen, setSaveModalOpen] = useState<boolean>(false)
  const [warnings, setWarnings] = useState<LogsWarning[]>([])
  const { data: subscription } = useOrgSubscriptionQuery({ orgSlug: organization?.slug })
  const { params, logData, error, isLoading, changeQuery, runQuery, setParams } = useLogsQuery(
    projectRef as string,
    {
      iso_timestamp_start: its ? (its as string) : undefined,
      iso_timestamp_end: ite ? (ite as string) : undefined,
    }
  )
  const [recentLogs, setRecentLogs] = useLocalStorage<LogSqlSnippets.Content[]>(
    `project-content-${projectRef}-recent-log-sql`,
    []
  )
  const addRecentLogSqlSnippet = (snippet: Partial<LogSqlSnippets.Content>) => {
    const defaults: LogSqlSnippets.Content = {
      schema_version: '1',
      favorite: false,
      sql: '',
      content_id: '',
    }
    setRecentLogs([...recentLogs, { ...defaults, ...snippet }])
  }

  const { showUpgradePrompt, setShowUpgradePrompt } = useUpgradePrompt(
    params.iso_timestamp_start as string
  )

  useEffect(() => {
    // on mount, set initial values
    if (q) {
      onSelectTemplate({
        mode: 'custom',
        searchString: q as string,
      })
    }
  }, [])

  useEffect(() => {
    let newWarnings = []
    const start = params.iso_timestamp_start ? dayjs(params.iso_timestamp_start) : dayjs()
    const end = params.iso_timestamp_end ? dayjs(params.iso_timestamp_end) : dayjs()
    const daysDiff = Math.abs(start.diff(end, 'days'))
    if (
      editorValue &&
      !editorValue.includes('limit') &&
      daysDiff > LOGS_LARGE_DATE_RANGE_DAYS_THRESHOLD
    ) {
      newWarnings.push({ text: 'When querying large date ranges, include a LIMIT clause.' })
    }
    setWarnings(newWarnings)
  }, [editorValue, params.iso_timestamp_start, params.iso_timestamp_end])

  // Show the prompt on page load based on query params
  useEffect(() => {
    if (its) {
      const shouldShowUpgradePrompt = maybeShowUpgradePrompt(its as string, subscription?.plan?.id)
      if (shouldShowUpgradePrompt) {
        setShowUpgradePrompt(!showUpgradePrompt)
      }
    }
  }, [its, subscription])

  const onSelectTemplate = (template: LogTemplate) => {
    setEditorValue(template.searchString)
    changeQuery(template.searchString)
    setEditorId(uuidv4())
    router.push({
      pathname: router.pathname,
      query: { ...router.query, q: template.searchString },
    })
    addRecentLogSqlSnippet({ sql: template.searchString })
  }

  const handleRun = (value?: string | React.MouseEvent<HTMLButtonElement>) => {
    const query = typeof value === 'string' ? value || editorValue : editorValue
    if (value && typeof value === 'string') {
      setEditorValue(value)
    }
    changeQuery(query)
    runQuery()
    router.push({
      pathname: router.pathname,
      query: { ...router.query, q: query },
    })
    addRecentLogSqlSnippet({ sql: query })
  }

  const handleClear = () => {
    setEditorValue('')
    setEditorId(uuidv4())
    changeQuery('')
  }

  const handleInsertSource = (source: LogsTableName) => {
    setEditorValue((prev) => {
      const index = prev.indexOf('from')
      if (index === -1) return `${prev}${source}`
      return `${prev.substring(0, index + 4)} ${source} ${prev.substring(index + 5)}`
    })
    setEditorId(uuidv4())
  }

  function handleOnSave() {
    setSaveModalOpen(!saveModalOpen)
  }

  const handleDateChange = ({ to, from }: DatePickerToFrom) => {
    const shouldShowUpgradePrompt = maybeShowUpgradePrompt(from, subscription?.plan?.id)

    if (shouldShowUpgradePrompt) {
      setShowUpgradePrompt(!showUpgradePrompt)
    } else {
      setParams((prev) => ({
        ...prev,
        iso_timestamp_start: from || '',
        iso_timestamp_end: to || '',
      }))
      router.push({
        pathname: router.pathname,
        query: { ...router.query, its: from || '', ite: to || '' },
      })
    }
  }

  const { isLoading: isSubmitting, mutate: createContent } = useContentInsertMutation({
    onError: (e) => {
      const error = e as { message: string }
      console.error(error)
      setSaveModalOpen(false)
      toast.error(`Failed to save query: ${error.message}`)
    },
    onSuccess: (values) => {
      setSaveModalOpen(false)
      toast.success(`Saved "${values[0].name}" log query`)
    },
  })

  return (
    <div className="w-full h-full mx-auto">
      <ResizablePanelGroup
        className="w-full h-full"
        direction="vertical"
        autoSaveId={LOCAL_STORAGE_KEYS.LOG_EXPLORER_SPLIT_SIZE}
      >
        <ResizablePanel collapsible minSize={5}>
          <LogsQueryPanel
            defaultFrom={params.iso_timestamp_start || ''}
            defaultTo={params.iso_timestamp_end || ''}
            onDateChange={handleDateChange}
            onSelectSource={handleInsertSource}
            onClear={handleClear}
            hasEditorValue={Boolean(editorValue)}
            templates={TEMPLATES.filter((template) => template.mode === 'custom')}
            onSelectTemplate={onSelectTemplate}
            onSave={handleOnSave}
            isLoading={isLoading}
            warnings={warnings}
          />

          <ShimmerLine active={isLoading} />
          <CodeEditor
            id={editorId}
            language="pgsql"
            defaultValue={editorValue}
            onInputChange={(v) => setEditorValue(v || '')}
            onInputRun={handleRun}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel collapsible minSize={5} className="flex flex-col flex-grow">
          <LoadingOpacity active={isLoading}>
            <LogTable
              showHistogramToggle={false}
              onRun={handleRun}
              onSave={handleOnSave}
              hasEditorValue={Boolean(editorValue)}
              params={params}
              data={logData}
              error={error}
              projectRef={projectRef as string}
            />
          </LoadingOpacity>
          <div className="flex flex-row justify-end mt-2">
            <UpgradePrompt show={showUpgradePrompt} setShowUpgradePrompt={setShowUpgradePrompt} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <Modal
        size="medium"
        onCancel={() => setSaveModalOpen(!saveModalOpen)}
        header="Save log query"
        visible={saveModalOpen}
        hideFooter
      >
        <Form
          initialValues={{
            name: '',
            desdcription: '',
          }}
          onSubmit={async (values: any, { setSubmitting }: any) => {
            setSubmitting(true)

            const payload = {
              id: uuidv4(),
              name: values.name,
              description: values.description || '',
              type: 'log_sql' as const,
              content: {
                content_id: editorId,
                sql: editorValue,
                schema_version: '1',
                favorite: false,
              },
              visibility: 'user' as const,
            }

            createContent({ projectRef: projectRef!, payload })
          }}
        >
          {() => (
            <>
              <Modal.Content className="space-y-6">
                <Input layout="horizontal" label="Name" id="name" />
                <div className="text-area-text-sm">
                  <Input.TextArea
                    layout="horizontal"
                    labelOptional="Optional"
                    label="Description"
                    id="description"
                    rows={2}
                  />
                </div>
              </Modal.Content>
              <Modal.Separator />
              <Modal.Content className="flex items-center justify-end gap-2">
                <Button size="tiny" type="default" onClick={() => setSaveModalOpen(!saveModalOpen)}>
                  Cancel
                </Button>
                <Button
                  size="tiny"
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  htmlType="submit"
                >
                  Save
                </Button>
              </Modal.Content>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}

LogsExplorerPage.getLayout = (page) => <LogsLayout>{page}</LogsLayout>

export default LogsExplorerPage
