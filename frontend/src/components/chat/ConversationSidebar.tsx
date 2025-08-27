import { useState, useMemo } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  IconButton,
  Typography,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Divider,
  Chip,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  AddRounded,
  SearchRounded,
  ChatRounded,
  MoreVertRounded,
  EditRounded,
  DeleteRounded,
  PushPinRounded,
  ArchiveRounded,
  ExpandMoreRounded,
  ExpandLessRounded,
  StarRounded,
  StarBorderRounded,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Conversation } from '../../types/chat';
import { formatDistanceToNow } from 'date-fns';
import { enUS, es, fr, de, zhCN, ja } from 'date-fns/locale';

interface ConversationSidebarProps {
  conversations: Conversation[];
  currentConversationId?: string;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  onRenameConversation?: (id: string, title: string) => void;
  onPinConversation?: (id: string) => void;
  onArchiveConversation?: (id: string) => void;
  onStarConversation?: (id: string) => void;
}

const localeMap = {
  en: enUS,
  es: es,
  fr: fr,
  de: de,
  zh: zhCN,
  ja: ja,
};

type ConversationFilter = 'all' | 'pinned' | 'starred' | 'archived';
type ConversationSort = 'recent' | 'alphabetical' | 'oldest';

export function ConversationSidebar({
  conversations,
  currentConversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onPinConversation,
  onArchiveConversation,
  onStarConversation,
}: ConversationSidebarProps) {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [sort] = useState<ConversationSort>('recent');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const locale = localeMap[i18n.language as keyof typeof localeMap] || enUS;

  // Filter and sort conversations
  const filteredConversations = useMemo(() => {
    let filtered = conversations.filter(conv => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          conv.title.toLowerCase().includes(query) ||
          conv.lastMessage?.toLowerCase().includes(query)
        );
      }
      return true;
    });

    // Category filter
    switch (filter) {
      case 'pinned':
        filtered = filtered.filter(conv => conv.isPinned);
        break;
      case 'starred':
        filtered = filtered.filter(conv => conv.isStarred);
        break;
      case 'archived':
        filtered = filtered.filter(conv => conv.isArchived);
        break;
      case 'all':
      default:
        filtered = filtered.filter(conv => !conv.isArchived);
        break;
    }

    // Sort conversations
    switch (sort) {
      case 'alphabetical':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        break;
      case 'recent':
      default:
        filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
    }

    // Separate pinned conversations
    const pinned = filtered.filter(conv => conv.isPinned);
    const unpinned = filtered.filter(conv => !conv.isPinned);
    
    return [...pinned, ...unpinned];
  }, [conversations, searchQuery, filter, sort]);

  const archivedCount = conversations.filter(conv => conv.isArchived).length;

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, conversationId: string) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedConversationId(conversationId);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedConversationId(null);
  };

  const handleStartEdit = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditingTitle(conversation.title);
    handleMenuClose();
  };

  const handleSaveEdit = () => {
    if (editingId && editingTitle.trim()) {
      onRenameConversation?.(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSaveEdit();
    } else if (event.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const formatLastActivity = (date: Date) => {
    return formatDistanceToNow(date, {
      addSuffix: true,
      locale,
    });
  };

  const getConversationPreview = (conversation: Conversation) => {
    if (conversation.lastMessage) {
      return conversation.lastMessage.length > 50
        ? `${conversation.lastMessage.substring(0, 50)}...`
        : conversation.lastMessage;
    }
    return t('chat.noMessages');
  };

  const renderConversationItem = (conversation: Conversation) => {
    const isSelected = conversation.id === currentConversationId;
    const isEditing = editingId === conversation.id;

    return (
      <ListItem
        key={conversation.id}
        disablePadding
        sx={{
          mb: 0.5,
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <ListItemButton
          selected={isSelected}
          onClick={() => !isEditing && onSelectConversation(conversation.id)}
          sx={{
            borderRadius: 1,
            '&.Mui-selected': {
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Box sx={{ position: 'relative' }}>
              <ChatRounded
                sx={{
                  color: isSelected ? 'inherit' : 'text.secondary',
                  fontSize: 20,
                }}
              />
              {conversation.isPinned && (
                <PushPinRounded
                  sx={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    fontSize: 12,
                    color: 'warning.main',
                  }}
                />
              )}
              {conversation.isStarred && (
                <StarRounded
                  sx={{
                    position: 'absolute',
                    bottom: -4,
                    right: -4,
                    fontSize: 12,
                    color: 'warning.main',
                  }}
                />
              )}
            </Box>
          </ListItemIcon>
          
          <ListItemText
            primary={
              isEditing ? (
                <TextField
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={handleKeyPress}
                  onBlur={handleSaveEdit}
                  size="small"
                  variant="standard"
                  autoFocus
                  fullWidth
                  inputProps={{
                    style: {
                      color: isSelected ? 'inherit' : undefined,
                    },
                  }}
                  sx={{
                    '& .MuiInput-underline:before': {
                      borderBottomColor: isSelected ? 'currentColor' : undefined,
                    },
                    '& .MuiInput-underline:after': {
                      borderBottomColor: isSelected ? 'currentColor' : undefined,
                    },
                  }}
                />
              ) : (
                <Typography
                  variant="subtitle2"
                  noWrap
                  sx={{
                    fontWeight: conversation.unreadCount ? 600 : 400,
                  }}
                >
                  {conversation.title}
                </Typography>
              )
            }
            secondary={
              !isEditing && (
                <Box component="span">
                  <Typography
                    variant="caption"
                    color={isSelected ? 'inherit' : 'text.secondary'}
                    sx={{ opacity: 0.8, display: 'block' }}
                    noWrap
                  >
                    {getConversationPreview(conversation)}
                  </Typography>
                  <Typography
                    variant="caption"
                    color={isSelected ? 'inherit' : 'text.secondary'}
                    sx={{ opacity: 0.6, fontSize: '0.7rem' }}
                  >
                    {formatLastActivity(new Date(conversation.updatedAt))}
                  </Typography>
                </Box>
              )
            }
            sx={{
              '& .MuiListItemText-secondary': {
                color: isSelected ? 'inherit' : undefined,
              },
            }}
          />
          
          {!isEditing && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {conversation.unreadCount > 0 && (
                <Chip
                  label={conversation.unreadCount}
                  size="small"
                  color="error"
                  sx={{
                    height: 20,
                    fontSize: '0.7rem',
                    '& .MuiChip-label': {
                      px: 0.5,
                    },
                  }}
                />
              )}
              
              <IconButton
                size="small"
                onClick={(e) => handleMenuOpen(e, conversation.id)}
                sx={{
                  opacity: 0.7,
                  '&:hover': {
                    opacity: 1,
                  },
                }}
              >
                <MoreVertRounded fontSize="small" />
              </IconButton>
            </Box>
          )}
        </ListItemButton>
      </ListItem>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {t('chat.conversations')}
          </Typography>
          <Tooltip title={t('chat.newConversation')}>
            <IconButton
              onClick={onNewConversation}
              size="small"
              color="primary"
            >
              <AddRounded />
            </IconButton>
          </Tooltip>
        </Box>
        
        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder={t('chat.searchConversations')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        
        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          {(['all', 'pinned', 'starred'] as ConversationFilter[]).map((filterType) => (
            <Chip
              key={filterType}
              label={t(`chat.filter.${filterType}`)}
              size="small"
              variant={filter === filterType ? 'filled' : 'outlined'}
              onClick={() => setFilter(filterType)}
              sx={{ fontSize: '0.7rem' }}
            />
          ))}
        </Box>
      </Box>
      
      {/* Conversation List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
        {filteredConversations.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '200px',
              textAlign: 'center',
              color: 'text.secondary',
            }}
          >
            <ChatRounded sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
            <Typography variant="body2">
              {searchQuery
                ? t('chat.noSearchResults')
                : t('chat.noConversations')}
            </Typography>
          </Box>
        ) : (
          <List sx={{ py: 0 }}>
            {filteredConversations.map(renderConversationItem)}
          </List>
        )}
        
        {/* Archived Conversations */}
        {archivedCount > 0 && filter !== 'archived' && (
          <Box sx={{ mt: 2 }}>
            <ListItemButton
              onClick={() => setShowArchived(!showArchived)}
              sx={{ borderRadius: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <ArchiveRounded />
              </ListItemIcon>
              <ListItemText
                primary={t('chat.archived')}
                secondary={t('chat.archivedCount', { count: archivedCount })}
              />
              {showArchived ? <ExpandLessRounded /> : <ExpandMoreRounded />}
            </ListItemButton>
            
            <Collapse in={showArchived}>
              <List sx={{ pl: 2 }}>
                {conversations
                  .filter(conv => conv.isArchived)
                  .map(renderConversationItem)}
              </List>
            </Collapse>
          </Box>
        )}
      </Box>
      
      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {selectedConversationId && (() => {
          const conversation = conversations.find(c => c.id === selectedConversationId);
          if (!conversation) return null;
          
          return [
            <MenuItem
              key="edit"
              onClick={() => handleStartEdit(conversation)}
            >
              <ListItemIcon>
                <EditRounded fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={t('chat.rename')} />
            </MenuItem>,
            
            <MenuItem
              key="pin"
              onClick={() => {
                onPinConversation?.(conversation.id);
                handleMenuClose();
              }}
            >
              <ListItemIcon>
                <PushPinRounded fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={conversation.isPinned ? t('chat.unpin') : t('chat.pin')}
              />
            </MenuItem>,
            
            <MenuItem
              key="star"
              onClick={() => {
                onStarConversation?.(conversation.id);
                handleMenuClose();
              }}
            >
              <ListItemIcon>
                {conversation.isStarred ? (
                  <StarRounded fontSize="small" />
                ) : (
                  <StarBorderRounded fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={conversation.isStarred ? t('chat.unstar') : t('chat.star')}
              />
            </MenuItem>,
            
            <Divider key="divider" />,
            
            <MenuItem
              key="archive"
              onClick={() => {
                onArchiveConversation?.(conversation.id);
                handleMenuClose();
              }}
            >
              <ListItemIcon>
                <ArchiveRounded fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={conversation.isArchived ? t('chat.unarchive') : t('chat.archive')}
              />
            </MenuItem>,
            
            <MenuItem
              key="delete"
              onClick={() => {
                onDeleteConversation?.(conversation.id);
                handleMenuClose();
              }}
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon>
                <DeleteRounded fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText primary={t('chat.delete')} />
            </MenuItem>,
          ];
        })()}
      </Menu>
    </Box>
  );
}