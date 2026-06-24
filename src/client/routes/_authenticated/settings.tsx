import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Divider,
  FileUpload,
  FileUploadTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Heading,
  Label,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
  TextInput,
} from '@etus/seven-react'
import { Icons } from '@/components/icons'
import { useAuth } from '@/hooks/use-auth'
import { UpdateProfileSchema, type UpdateProfileInput } from '@shared/schemas'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { user } = useAuth()

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileSchema),
    defaultValues: {
      name: user?.name ?? '',
    },
  })

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email
      ? user.email[0].toUpperCase()
      : '?'

  const onSubmit = async (data: UpdateProfileInput) => {
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast.success('Profile updated successfully')
      console.log('Profile data:', data)
    } catch {
      toast.error('Failed to update profile. Please try again.')
    }
  }

  const handlePhotoChange = () => {
    toast.info('Trocar foto — em breve')
    // TODO(stub)
  }

  const handleDisconnectProvider = () => {
    toast.info('Desconectar conta — em breve')
    // TODO(stub)
  }

  const handleRevokeSession = () => {
    toast.info('Revogar sessão — em breve')
    // TODO(stub)
  }

  const handleDeleteAccount = () => {
    toast.info('Excluir conta — em breve')
    // TODO(stub)
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <Heading level={1} size="2xl">Settings</Heading>
        <Text variant="p2" color="muted">
          Manage your account settings and preferences.
        </Text>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">
            <Icons.user className="mr-2 h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="account">
            <Icons.settings className="mr-2 h-4 w-4" />
            Account
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Icons.bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
              <CardDescription>
                Your profile picture is visible to other team members.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user?.picture ?? undefined} alt={user?.name ?? ''} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <FileUpload
                  accept="image/jpeg,image/png,image/gif"
                  maxSize={2 * 1024 * 1024}
                  showPreview={false}
                  onChange={handlePhotoChange}
                  className="w-auto"
                >
                  <FileUploadTrigger className="h-8 border border-input bg-background px-3 text-xs text-foreground hover:bg-accent hover:text-accent-foreground">
                    <Icons.camera className="h-4 w-4" />
                    Change Photo
                  </FileUploadTrigger>
                </FileUpload>
                <Text as="p" variant="caption1" color="muted">
                  JPG, PNG or GIF. Max 2MB.
                </Text>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Update your personal details here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={(e) => { void form.handleSubmit(onSubmit)(e) }} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <TextInput placeholder="Enter your name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-2">
                      <Label>Email Address</Label>
                      <TextInput
                        type="email"
                        defaultValue={user?.email ?? ''}
                        placeholder="Enter your email"
                        disabled
                      />
                      <Text as="p" variant="caption1" color="muted">
                        Email cannot be changed.
                      </Text>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" loading={form.formState.isSubmitting}>
                      Save Changes
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connected Accounts</CardTitle>
              <CardDescription>
                Manage your connected OAuth providers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Icons.google className="h-5 w-5" />
                  </div>
                  <div>
                    <Text as="p" weight="medium">Google</Text>
                    <Text variant="p3" color="muted">
                      {user?.email}
                    </Text>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-sm text-success">
                    <Icons.check className="h-4 w-4" />
                    Connected
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Desconectar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Desconectar conta Google?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Você precisará reconectar este provedor para acessar sua conta por
                          ele novamente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={handleDisconnectProvider}
                        >
                          Desconectar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sessions</CardTitle>
              <CardDescription>
                Manage your active sessions across devices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Icons.globe className="h-5 w-5" />
                  </div>
                  <div>
                    <Text as="p" weight="medium">Current Session</Text>
                    <Text variant="p3" color="muted">
                      Your current browser session
                    </Text>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-success">Active</span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Revogar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revogar esta sessão?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Você será desconectado deste dispositivo e precisará entrar
                          novamente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={handleRevokeSession}
                        >
                          Revogar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible and destructive actions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Text as="p" weight="medium">Delete Account</Text>
                  <Text variant="p3" color="muted">
                    Permanently delete your account and all associated data.
                  </Text>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação é permanente e não pode ser desfeita. Todos os seus dados
                        serão removidos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={handleDeleteAccount}
                      >
                        Excluir conta
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>
                Choose what emails you want to receive.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <NotificationToggle
                title="Team Invitations"
                description="Receive emails when someone invites you to a team."
                defaultChecked
              />
              <Divider />
              <NotificationToggle
                title="Product Updates"
                description="News about product updates and new features."
                defaultChecked
              />
              <Divider />
              <NotificationToggle
                title="Security Alerts"
                description="Important notifications about your account security."
                defaultChecked
                disabled
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function NotificationToggle({
  title,
  description,
  defaultChecked = false,
  disabled = false,
}: {
  title: string
  description: string
  defaultChecked?: boolean
  disabled?: boolean
}) {
  const [checked, setChecked] = useState(defaultChecked)

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Text as="p" weight="medium">{title}</Text>
        <Text variant="p3" color="muted">{description}</Text>
      </div>
      <Switch
        aria-label={title}
        checked={checked}
        disabled={disabled}
        onCheckedChange={setChecked}
      />
    </div>
  )
}
