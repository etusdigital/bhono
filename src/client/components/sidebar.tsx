import { Link, useLocation } from '@tanstack/react-router'
import {
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sidebar,
  SidebarAvatar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@etus/seven-react'
import { Icons } from '@/components/icons'
import { useAuth } from '@/hooks/use-auth'
import { useTheme } from '@/hooks/use-theme'

const mainNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: Icons.dashboard },
  { to: '/team', label: 'Team', icon: Icons.users },
  { to: '/workspaces', label: 'Workspaces', icon: Icons.layers },
  { to: '/integrations', label: 'Integrations', icon: Icons.blocks },
] as const

const accountNavItems = [
  { to: '/account', label: 'Account', icon: Icons.user },
  { to: '/settings', label: 'Settings', icon: Icons.settings },
] as const

/**
 * App shell sidebar, composed from the Seven `Sidebar` system (single mode,
 * collapsible to icon rail). Navigation/auth/theme logic is preserved; the
 * presentation is the Seven DS. The footer uses `SidebarAvatar` + a dropdown
 * (the idiomatic user-identity footer), and active items carry aria-current.
 */
export function AppSidebar() {
  const location = useLocation()
  const { user, logout, isLoggingOut } = useAuth()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email
      ? user.email[0].toUpperCase()
      : '?'

  const cycleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="Hono">
              <Link to="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Icons.command className="size-4" />
                </div>
                <span className="font-semibold">Hono</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                const active = location.pathname === item.to
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link aria-current={active ? 'page' : undefined} to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {accountNavItems.map((item) => {
                const active = location.pathname === item.to
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link aria-current={active ? 'page' : undefined} to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={`Theme: ${theme}`} onClick={cycleTheme}>
              {resolvedTheme === 'dark' ? <Icons.moon /> : <Icons.sun />}
              <span>Theme</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarAvatar
                  compact={collapsed}
                  avatar={{
                    children: (
                      <>
                        <AvatarImage alt={user?.name ?? ''} src={user?.picture ?? undefined} />
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </>
                    ),
                  }}
                  email={user?.email ?? undefined}
                  name={user?.name ?? undefined}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" side="top">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {user?.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={isLoggingOut} onClick={() => { logout() }}>
                  <Icons.logout />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
