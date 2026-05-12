import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

// Types
interface Notification {
  id: string;
  type: 'TRANSACTION_VERIFIED' | 'TRANSACTION_RECEIVED' | 'TOKEN_LOW' | 'TOKEN_DEPLETED';
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data?: any;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch notifications with polling
  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications', {
        params: { page: 1, limit: 20, unreadOnly: false },
      });
      return res.data;
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const notifications = notificationsData?.notifications || [];

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = Array.isArray(notifications) 
    ? notifications.filter((n: Notification) => !n.isRead).length 
    : 0;

  const getIcon = (type: string) => {
    switch (type) {
      case 'TRANSACTION_VERIFIED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'TRANSACTION_RECEIVED':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'TOKEN_LOW':
      case 'TOKEN_DEPLETED':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notifications</span>
            {unreadCount > 0 && (
                <span className="text-xs font-normal text-muted-foreground">{unreadCount} unread</span>
            )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[300px] overflow-y-auto">
          {!Array.isArray(notifications) || notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            notifications.map((notification: Notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  "flex flex-col items-start gap-1 p-3 cursor-pointer",
                  !notification.isRead && "bg-muted/50"
                )}
                onClick={(e: React.MouseEvent) => {
                    // e.preventDefault(); 
                    if (!notification.isRead) {
                        markAsReadMutation.mutate(notification.id);
                    }
                }}
              >
                <div className="flex w-full items-start gap-2">
                  {getIcon(notification.type)}
                  <div className="flex-1 space-y-1">
                    <p className={cn("text-sm font-medium leading-none", !notification.isRead && "font-bold")}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.body}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <div className="h-2 w-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                  )}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
