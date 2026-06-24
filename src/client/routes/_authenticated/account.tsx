import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Heading,
  Text,
  TextInput,
} from '@etus/seven-react'
import { Icons } from '@/components/icons'
import { useAuth } from '@/hooks/use-auth'

export const Route = createFileRoute('/_authenticated/account')({
  component: AccountPage,
})

function AccountPage() {
  const { user }  = useAuth()

  // TODO(stub): ligar a fluxos/mutations reais (OAuth link, 2FA setup, API key, export, revogar sessões)
  const handleConnectGitHub = () => { toast.info('Conectar GitHub — em breve') }
  const handleEnable2FA = () => { toast.info('Ativar 2FA — em breve') }
  const handleCreateKey = () => { toast.info('Criar API key — em breve') }
  const handleExport = () => { toast.info('Exportar dados — em breve') }
  const handleSignOutAll = () => { toast.info('Encerrar todas as sessões — em breve') }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <Heading level={1} size="2xl" weight="semibold">Account</Heading>
        <Text color="muted">
          Manage your account settings, security, and connected services.
        </Text>
      </div>

      {/* Connected Accounts Section */}
      <section className="space-y-4">
        <div>
          <Heading level={2} size="lg" weight="medium">Connected Accounts</Heading>
          <Text variant="p3" color="muted">
            Manage OAuth providers linked to your account.
          </Text>
        </div>

        <div className="grid gap-4">
          {/* Google Account - Connected */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <Icons.google className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">Google</p>
                  <Badge color="success" className="text-xs">Connected</Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:block">
                  Primary login method
                </span>
              </div>
            </div>
          </Card>

          {/* GitHub Account - Not Connected */}
          <Card className="overflow-hidden border-dashed">
            <div className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <Icons.gitHub className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">GitHub</p>
                  <Badge type="badge-outline" className="text-xs">Not connected</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connect for additional sign-in options
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleConnectGitHub}>
                <Icons.plus className="mr-2 h-4 w-4" />
                Connect
              </Button>
            </div>
          </Card>
        </div>
      </section>

      <Divider />

      {/* Security Section */}
      <section className="space-y-4">
        <div>
          <Heading level={2} size="lg" weight="medium">Security</Heading>
          <Text variant="p3" color="muted">
            Keep your account secure with these settings.
          </Text>
        </div>

        <div className="grid gap-4">
          {/* Two-Factor Authentication */}
          <Card>
            <div className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning-subtle">
                <Icons.shield className="h-6 w-6 text-warning" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">Two-Factor Authentication</p>
                  <Badge color="warning" className="text-xs">Recommended</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleEnable2FA}>
                Enable
              </Button>
            </div>
          </Card>

          {/* Password */}
          <Card>
            <div className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <Icons.key className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Password</p>
                <p className="text-sm text-muted-foreground">
                  Using OAuth login - no password set
                </p>
              </div>
              <Button variant="outline" size="sm" disabled>
                <Icons.pencil className="mr-2 h-4 w-4" />
                Change
              </Button>
            </div>
          </Card>
        </div>
      </section>

      <Divider />

      {/* Active Sessions Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Heading level={2} size="lg" weight="medium">Active Sessions</Heading>
            <Text variant="p3" color="muted">
              Devices where you're currently logged in.
            </Text>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                Sign out all
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Encerrar todas as sessões?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso desconecta você de todos os dispositivos, exceto o atual.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleSignOutAll}>Encerrar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="grid gap-4">
          <SessionCard
            device="Chrome on macOS"
            location="San Francisco, CA"
            lastActive="Active now"
            isCurrent
          />
          <SessionCard
            device="Safari on iPhone"
            location="San Francisco, CA"
            lastActive="2 hours ago"
          />
        </div>
      </section>

      <Divider />

      {/* API Access Section */}
      <section className="space-y-4">
        <div>
          <Heading level={2} size="lg" weight="medium">API Access</Heading>
          <Text variant="p3" color="muted">
            Manage API keys for programmatic access.
          </Text>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">API Keys</CardTitle>
              <Button size="sm" onClick={handleCreateKey}>
                <Icons.plus className="mr-2 h-4 w-4" />
                Create Key
              </Button>
            </div>
            <CardDescription>
              Generate API keys to integrate with external services.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Icons.key className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No API keys created yet
              </p>
              <p className="text-xs text-muted-foreground">
                Create a key to get started with the API
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Divider />

      {/* Danger Zone */}
      <section className="space-y-4">
        <div>
          <Heading level={2} size="lg" weight="medium" className="text-destructive">Danger Zone</Heading>
          <Text variant="p3" color="muted">
            Irreversible and destructive actions.
          </Text>
        </div>

        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Export Data */}
              <div className="space-y-2">
                <p className="font-medium">Export Data</p>
                <p className="text-sm text-muted-foreground">
                  Download a copy of all your data.
                </p>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Icons.arrowRight className="mr-2 h-4 w-4 -rotate-45" />
                  Export
                </Button>
              </div>

              {/* Delete Account */}
              <div className="space-y-2">
                <p className="font-medium">Delete Account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and data.
                </p>
                <DeleteAccountDialog userEmail={user?.email ?? ''} />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function SessionCard({
  device,
  location,
  lastActive,
  isCurrent = false,
}: {
  device: string
  location: string
  lastActive: string
  isCurrent?: boolean
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Icons.globe className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm">{device}</p>
          {isCurrent && (
            <Badge color="success" className="text-xs">Current</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {location} · {lastActive}
        </p>
      </div>
      {!isCurrent && (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => { toast.info('Encerrar sessão — em breve') }}
        >
          <Icons.logout className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

function DeleteAccountDialog({ userEmail }: { userEmail: string }) {
  const [isOpen, setIsOpen] = useState(false)

  const DeleteConfirmSchema = useMemo(
    () =>
      z.object({
        confirmText: z.string().refine((val) => val === userEmail, {
          message: 'Digite seu email corretamente para confirmar',
        }),
      }),
    [userEmail]
  )

  type DeleteConfirmInput = z.infer<typeof DeleteConfirmSchema>

  const form = useForm<DeleteConfirmInput>({
    resolver: zodResolver(DeleteConfirmSchema),
    defaultValues: {
      confirmText: '',
    },
  })

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) form.reset()
  }

  const onSubmit = async (_data: DeleteConfirmInput) => {
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000))
      toast.success('Account deleted successfully')
      setIsOpen(false)
      form.reset()
    } catch {
      toast.error('Failed to delete account. Please try again.')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Icons.trash className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={(e) => { void form.handleSubmit(onSubmit)(e) }}>
            <DialogHeader>
              <DialogTitle className="text-destructive">Delete Account</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete your account
                and remove all associated data from our servers.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-destructive/10 p-4 text-sm">
                <p className="font-medium text-destructive">Warning</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                  <li>All your data will be permanently deleted</li>
                  <li>You will lose access to all workspaces</li>
                  <li>This action is irreversible</li>
                </ul>
              </div>

              <FormField
                control={form.control}
                name="confirmText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Type <span className="font-mono font-medium">{userEmail}</span> to confirm
                    </FormLabel>
                    <FormControl>
                      <TextInput
                        placeholder="Enter your email"
                        className="font-mono"
                        {...field}
                      />
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
              <Button
                type="submit"
                variant="destructive"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Icons.trash className="mr-2 h-4 w-4" />
                    Delete Account
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
