import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Label,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
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

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
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
                <Button variant="outline" size="sm">
                  <Icons.camera className="mr-2 h-4 w-4" />
                  Change Photo
                </Button>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG or GIF. Max 2MB.
                </p>
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
                      <p className="text-xs text-muted-foreground">
                        Email cannot be changed.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting && (
                        <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                      )}
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
                    <p className="font-medium">Google</p>
                    <p className="text-sm text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-sm text-success">
                    <Icons.check className="h-4 w-4" />
                    Connected
                  </span>
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
                    <p className="font-medium">Current Session</p>
                    <p className="text-sm text-muted-foreground">
                      Your current browser session
                    </p>
                  </div>
                </div>
                <span className="text-sm text-success">Active</span>
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
                  <p className="font-medium">Delete Account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all associated data.
                  </p>
                </div>
                <Button variant="destructive" size="sm">
                  Delete Account
                </Button>
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
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
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
