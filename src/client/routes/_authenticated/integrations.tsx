import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Divider,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  TextInput,
} from '@etus/seven-react'
import { Icons } from '@/components/icons'
import { CreateWebhookSchema, type CreateWebhookInput } from '@shared/schemas'

export const Route = createFileRoute('/_authenticated/integrations')({
  component: IntegrationsPage,
})

// Mock integrations data
const availableIntegrations = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send notifications and updates to Slack channels',
    category: 'communication',
    connected: true,
    icon: SlackIcon,
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Post updates to Discord servers',
    category: 'communication',
    connected: false,
    icon: DiscordIcon,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Process payments and manage subscriptions',
    category: 'payments',
    connected: true,
    icon: StripeIcon,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Sync repositories and track issues',
    category: 'development',
    connected: false,
    icon: Icons.gitHub,
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Sync issues and project management',
    category: 'development',
    connected: false,
    icon: LinearIcon,
  },
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect with 5,000+ apps via automation',
    category: 'automation',
    connected: false,
    icon: ZapierIcon,
  },
]

// Mock webhooks data
const webhooks = [
  {
    id: '1',
    url: 'https://api.example.com/webhooks/receive',
    events: ['user.created', 'user.updated'],
    status: 'active',
    lastDelivery: '2 minutes ago',
    lastStatus: 'success',
  },
]

function IntegrationsPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'communication', label: 'Communication' },
    { id: 'payments', label: 'Payments' },
    { id: 'development', label: 'Development' },
    { id: 'automation', label: 'Automation' },
  ]

  const [activeCategory, setActiveCategory] = useState('all')

  const filteredIntegrations = availableIntegrations.filter((integration) => {
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = activeCategory === 'all' || integration.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const connectedCount = availableIntegrations.filter((i) => i.connected).length

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Connect third-party services and manage webhooks.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex h-2 w-2 rounded-full bg-emerald-500" />
          {connectedCount} connected
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Icons.search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <TextInput
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value) }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={activeCategory === category.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => { setActiveCategory(category.id) }}
              className="shrink-0"
            >
              {category.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Integrations Grid */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Available Integrations</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredIntegrations.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </div>
        {filteredIntegrations.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Icons.search className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No integrations found matching your search.
            </p>
          </div>
        )}
      </section>

      <Divider />

      {/* Webhooks Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Webhooks</h2>
            <p className="text-sm text-muted-foreground">
              Receive real-time notifications when events happen.
            </p>
          </div>
          <CreateWebhookDialog />
        </div>

        {webhooks.length > 0 ? (
          <div className="space-y-3">
            {webhooks.map((webhook) => (
              <WebhookCard key={webhook.id} webhook={webhook} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Icons.globe className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-medium">No webhooks configured</p>
              <p className="text-xs text-muted-foreground">
                Create a webhook to receive real-time event notifications.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <Divider />

      {/* API Documentation Link */}
      <section>
        <Card className="bg-muted/50">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background">
                <Icons.zap className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Build Custom Integrations</p>
                <p className="text-sm text-muted-foreground">
                  Use our API to build your own integrations.
                </p>
              </div>
            </div>
            <Button variant="outline">
              View API Docs
              <Icons.arrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

type Integration = typeof availableIntegrations[0]

function IntegrationCard({ integration }: { integration: Integration }) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [connected, setConnected] = useState(integration.connected)

  const handleToggle = async () => {
    setIsConnecting(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setConnected(!connected)
    setIsConnecting(false)
  }

  const Icon = integration.icon

  return (
    <Card className={`transition-all hover:shadow-md ${connected ? 'ring-1 ring-emerald-500/20' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${connected ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'}`}>
            <Icon className={`h-6 w-6 ${connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium">{integration.name}</p>
              {connected && (
                <Badge color="success" className="text-xs">Connected</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {integration.description}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Badge type="badge-outline" className="text-xs capitalize">
            {integration.category}
          </Badge>
          <Button
            variant={connected ? 'outline' : 'default'}
            size="sm"
            onClick={() => { void handleToggle() }}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <Icons.spinner className="h-4 w-4 animate-spin" />
            ) : connected ? (
              <>
                <Icons.settings className="mr-2 h-4 w-4" />
                Configure
              </>
            ) : (
              <>
                <Icons.plus className="mr-2 h-4 w-4" />
                Connect
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

type Webhook = typeof webhooks[0]

function WebhookCard({ webhook }: { webhook: Webhook }) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    await new Promise((resolve) => setTimeout(resolve, 500))
    setIsDeleting(false)
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${webhook.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <code className="text-sm font-mono truncate">{webhook.url}</code>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {webhook.events.map((event) => (
                <Badge key={event} color="muted" className="text-xs font-mono">
                  {event}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Icons.clock className="h-3 w-3" />
                Last delivery: {webhook.lastDelivery}
              </span>
              <span className={`flex items-center gap-1 ${webhook.lastStatus === 'success' ? 'text-emerald-600' : 'text-destructive'}`}>
                {webhook.lastStatus === 'success' ? (
                  <Icons.check className="h-3 w-3" />
                ) : (
                  <Icons.close className="h-3 w-3" />
                )}
                {webhook.lastStatus}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Icons.pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => { void handleDelete() }}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Icons.spinner className="h-4 w-4 animate-spin" />
              ) : (
                <Icons.trash className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CreateWebhookDialog() {
  const [isOpen, setIsOpen] = useState(false)

  const eventTypes = [
    { id: 'user.created', label: 'User Created' },
    { id: 'user.updated', label: 'User Updated' },
    { id: 'user.deleted', label: 'User Deleted' },
    { id: 'team.member_added', label: 'Team Member Added' },
    { id: 'team.member_removed', label: 'Team Member Removed' },
    { id: 'invoice.paid', label: 'Invoice Paid' },
  ]

  const form = useForm<CreateWebhookInput>({
    resolver: zodResolver(CreateWebhookSchema),
    defaultValues: {
      url: '',
      events: [],
    },
  })

  const selectedEvents = form.watch('events')

  const toggleEvent = (eventId: string) => {
    const currentEvents = form.getValues('events')
    if (currentEvents.includes(eventId)) {
      form.setValue('events', currentEvents.filter((e) => e !== eventId), { shouldValidate: true })
    } else {
      form.setValue('events', [...currentEvents, eventId], { shouldValidate: true })
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) form.reset()
  }

  const onSubmit = async (data: CreateWebhookInput) => {
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      console.log('Webhook created:', data)
      setIsOpen(false)
      form.reset()
    } catch {
      // Handle error
      console.error('Failed to create webhook')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Icons.plus className="mr-2 h-4 w-4" />
          Add Webhook
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <Form {...form}>
          <form onSubmit={(e) => { void form.handleSubmit(onSubmit)(e) }}>
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
              <DialogDescription>
                Configure a URL to receive POST requests when events occur.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endpoint URL</FormLabel>
                    <FormControl>
                      <TextInput
                        type="url"
                        placeholder="https://api.example.com/webhooks"
                        className="font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      We'll send a POST request to this URL when events occur.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="events"
                render={() => (
                  <FormItem>
                    <FormLabel>Events to Subscribe</FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-2 gap-2">
                        {eventTypes.map((event) => {
                          const isSelected = selectedEvents.includes(event.id)
                          return (
                            <label
                              key={event.id}
                              className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                                isSelected
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-primary/50'
                              }`}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => { toggleEvent(event.id) }}
                              />
                              <span className={isSelected ? 'font-medium' : ''}>{event.label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsOpen(false) }}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Webhook'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// Custom Icons for Integrations
function SlackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  )
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  )
}

function StripeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
    </svg>
  )
}

function LinearIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M3.88 2.56c-.6.6-.6 1.58 0 2.19l15.37 15.37c.6.6 1.58.6 2.19 0 .6-.6.6-1.58 0-2.19L6.07 2.56c-.6-.6-1.58-.6-2.19 0zM1.28 8.53c-.33.33-.33.85 0 1.18l13.02 13.02c.32.32.85.32 1.17 0 .33-.33.33-.85 0-1.18L2.45 8.53c-.32-.32-.85-.32-1.17 0zm6.08-6.08c-.33.33-.33.85 0 1.18l13.02 13.02c.32.32.85.32 1.17 0 .33-.33.33-.85 0-1.18L8.53 2.45c-.32-.32-.85-.32-1.17 0zM1.28 14.6c-.33.33-.33.85 0 1.18l6.95 6.95c.32.32.85.32 1.17 0 .33-.33.33-.85 0-1.18l-6.95-6.95c-.32-.32-.85-.32-1.17 0zm12.13-12.13c-.32.33-.32.85 0 1.18l6.95 6.95c.32.32.85.32 1.17 0 .33-.33.33-.85 0-1.18l-6.95-6.95c-.32-.32-.85-.32-1.17 0z" />
    </svg>
  )
}

function ZapierIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M15.734 3.993l-1.478 3.563-3.564 1.478 3.564 1.478 1.478 3.563 1.478-3.563 3.563-1.478-3.563-1.478zM8.17 11.931L6.48 16.008l-4.076 1.691 4.076 1.691 1.69 4.077 1.691-4.077 4.077-1.69-4.077-1.692zM19.996 14.222l-.934 2.251-2.25.933 2.25.934.934 2.25.934-2.25 2.25-.934-2.25-.933z" />
    </svg>
  )
}
