import { Link, useLocation } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage, Button } from '@etus/seven-react'
import { Separator } from '@/components/ui/separator'
import { Icons } from '@/components/icons'
import { useAuth } from '@/hooks/use-auth'
import { useTheme } from '@/hooks/use-theme'

interface SidebarProps {
  defaultCollapsed?: boolean
}

const mainNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: Icons.dashboard },
  { to: '/team', label: 'Team', icon: Icons.users },
  { to: '/workspaces', label: 'Workspaces', icon: Icons.layers },
  { to: '/integrations', label: 'Integrations', icon: Icons.blocks },
]

const accountNavItems = [
  { to: '/account', label: 'Account', icon: Icons.user },
  { to: '/settings', label: 'Settings', icon: Icons.settings },
]

// Detect platform for keyboard shortcut display (use userAgent since platform is deprecated)
const getIsMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)

export function Sidebar({ defaultCollapsed = false }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const [isMac] = useState(getIsMac)
  const { user, logout, isLoggingOut } = useAuth()
  const location = useLocation()
  const { theme, setTheme, resolvedTheme } = useTheme()

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email
      ? user.email[0].toUpperCase()
      : '?'

  // Keyboard shortcut to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsCollapsed((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown) }
  }, [])

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r bg-sidebar transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex h-14 items-center border-b px-3",
        isCollapsed ? "justify-center" : "justify-between"
      )}>
        <Link
          to="/dashboard"
          className={cn(
            "flex items-center gap-2 font-semibold transition-opacity",
            isCollapsed && "justify-center"
          )}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Icons.command className="h-4 w-4" />
          </div>
          {!isCollapsed && <span className="text-sidebar-foreground">Hono</span>}
        </Link>

        {!isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => { setIsCollapsed(true) }}
          >
            <Icons.chevronRight className="h-4 w-4 rotate-180" />
          </Button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {isCollapsed && (
        <div className="flex justify-center py-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => { setIsCollapsed(false) }}
          >
            <Icons.chevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {!isCollapsed && (
            <p className="px-3 py-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
              Main
            </p>
          )}
          {mainNavItems.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              isActive={location.pathname === item.to}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>

        <Separator className="my-4 bg-sidebar-border" />

        <div className="space-y-1">
          {!isCollapsed && (
            <p className="px-3 py-2 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
              Account
            </p>
          )}
          {accountNavItems.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              isActive={location.pathname === item.to}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>
      </nav>

      {/* Theme toggle and keyboard shortcut hint */}
      <div className={cn(
        "px-3 py-2",
        isCollapsed ? "flex justify-center" : "flex items-center justify-between"
      )}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={() => {
            const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
            setTheme(next)
          }}
          title={`Theme: ${theme} (click to change)`}
        >
          {resolvedTheme === 'dark' ? (
            <Icons.moon className="h-4 w-4" />
          ) : (
            <Icons.sun className="h-4 w-4" />
          )}
        </Button>
        {!isCollapsed && (
          <p className="text-xs text-sidebar-foreground/40">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-sidebar-accent rounded">
              {isMac ? '⌘' : 'Ctrl+'}B
            </kbd>
            {' '}collapse
          </p>
        )}
      </div>

      <Separator className="bg-sidebar-border" />

      {/* User Profile */}
      <div className={cn(
        "p-3",
        isCollapsed ? "flex justify-center" : ""
      )}>
        {isCollapsed ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full p-0 hover:bg-sidebar-accent"
            onClick={() => { logout() }}
            disabled={isLoggingOut}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.picture ?? undefined} alt={user?.name ?? ''} />
              <AvatarFallback className="text-xs bg-sidebar-accent text-sidebar-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        ) : (
          <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-sidebar-accent transition-colors">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={user?.picture ?? undefined} alt={user?.name ?? ''} />
              <AvatarFallback className="text-xs bg-sidebar-accent text-sidebar-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.name}
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {user?.email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => { logout() }}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <Icons.spinner className="h-4 w-4 animate-spin" />
              ) : (
                <Icons.logout className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}

function NavItem({
  to,
  label,
  icon: Icon,
  isActive,
  isCollapsed,
}: {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  isActive: boolean
  isCollapsed: boolean
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
        isCollapsed && "justify-center px-2",
        isActive
          ? "bg-sidebar-accent text-sidebar-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
      title={isCollapsed ? label : undefined}
    >
      <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
      {!isCollapsed && <span>{label}</span>}
      {!isCollapsed && isActive && (
        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
      )}
    </Link>
  )
}
