import { Design } from '@revenge-mod/discord/design'
import { Stores } from '@revenge-mod/discord/flux'
import { getModules, lookupModule } from '@revenge-mod/modules/finders'
import {
    withDependencies,
    withName,
    withProps,
} from '@revenge-mod/modules/finders/filters'
import { after, instead } from '@revenge-mod/patcher'
import { registerPlugin } from '@revenge-mod/plugins/_'
import { PluginFlags } from '@revenge-mod/plugins/constants'
import { isProxy } from '@revenge-mod/utils/proxy'
import { findInReactFiber } from '@revenge-mod/utils/react'
import { Image, Pressable, StyleSheet, View } from 'react-native'
import { SettingsComponent } from './settings'
import type { AssetId } from '@revenge-mod/assets/types'
import type { DiscordModules } from '@revenge-mod/discord/types'
import type { Storage } from '@revenge-mod/storage'
import type { ComponentProps, FC, ReactElement, ReactNode } from 'react'

export enum DataSource {
    Global,
    Guild,
    /**
     * For names only
     */
    Username,
}

export const ChannelListAppearance = {
    Ellipsis: 1,
    Avatars: 2,
    IncludeMuted: 4,
} as const

export interface Settings {
    avatar: DataSource | false
    name: DataSource | false
    channel: {
        appearance: number
        maxAvatars?: number
    }
}

registerPlugin<{
    storage: Settings
}>(
    {
        id: 'palmdevs.better-typing-indicators',
        name: 'Better Typing Indicators',
        description:
            'Typing indicator in channels, with user avatars, tap to open profile, and more.',
        author: 'Palm',
        icon: 'SuperReactionIcon',
    },
    {
        start({ cleanup, plugin, storage }) {
            // Discord caches rendered components, so we need to reload to apply the patch properly.
            if (plugin.flags & PluginFlags.EnabledLate)
                plugin.flags |= PluginFlags.ReloadRequired

            cleanup(
                getModules(
                    withName<FC>('TypingIndicator'),
                    TypingIndicatorModule => {
                        cleanup(
                            patchTypingIndicator(
                                TypingIndicatorModule as { default: FC },
                                storage,
                            ),
                        )
                    },
                    { returnNamespace: true },
                ),
                // getModules(
                //     withName<FC>('ChannelInfo'),
                //     ChannelInfoModule => {
                //         cleanup(
                //             patchChannelInfo(
                //                 ChannelInfoModule as { default: FC },
                //                 storage,
                //             ),
                //         )
                //     },
                //     { returnNamespace: true },
                // ),
                // getModules(
                //     withProps<{ ThreadChannel: ThreadChannelComponent }>(
                //         'ThreadChannel',
                //     ),
                //     ThreadChannelModule => {
                //         cleanup(
                //             patchThreadChannel(ThreadChannelModule, storage),
                //         )
                //     },
                // ),
            )
        },
        stop({ plugin }) {
            // We could force a re-render, but you aren't going to be constantly enabling and disabling this plugin anyways.
            plugin.flags |= PluginFlags.ReloadRequired
        },
        storage: {
            default: {
                avatar: DataSource.Guild,
                name: DataSource.Guild,
                channel: {
                    appearance:
                        ChannelListAppearance.Ellipsis |
                        ChannelListAppearance.Avatars,
                    maxAvatars: 3,
                },
            },
            load: true,
        },
        SettingsComponent,
    },
    PluginFlags.Enabled,
    0,
)

const styles = StyleSheet.create({
    avatar: {
        width: 16,
        height: 16,
        alignSelf: 'center',
        borderRadius: 8,
        marginRight: 4,
    },
    container: {
        flexDirection: 'row',
    },
    wrap: {
        flexWrap: 'wrap',
    },
})

function patchChannelInfo(
    ChannelInfoModule: { default: FC },
    storage: Storage<Settings>,
) {
    return instead(ChannelInfoModule, 'default', function (args, orig) {
        // console.log(args)
        const tree = orig.apply(this, args)
        // console.log(tree)
        return tree
    })
}

function patchThreadChannel(
    module: {
        ThreadChannel: ThreadChannelComponent
    },
    storage: Storage<Settings>,
) {
    return after(module, 'ThreadChannel', tree => {
        // console.log(tree)
        return tree
    })
}

function patchTypingIndicator(
    TypingIndicatorModule: { default: FC },
    storage: Storage<Settings>,
) {
    return after(TypingIndicatorModule, 'default', result => {
        const tree = result as ReactElement<TypingIndicatorTreeProps>

        if (!isProxy(tree.props.renderItem))
            after(tree.props, 'renderItem', result => {
                const renderItemTree = result as ReactElement<
                    RenderTypingIndicatorProps,
                    FC<RenderTypingIndicatorProps>
                >

                if (renderItemTree.props.typingUserIds.length) {
                    if (!isProxy(renderItemTree.type))
                        after(renderItemTree, 'type', result =>
                            patchTypingView(
                                result as ReactElement,
                                renderItemTree.props,
                                storage,
                            ),
                        )
                }

                return renderItemTree
            })

        return tree
    })
}

function patchTypingView(
    tree: ReactElement,
    { typingUserIds, channel }: RenderTypingIndicatorProps,
    storage: Storage<Settings>,
) {
    const { id: channelId, guild_id: guildId } = channel

    const UserStore = Stores.UserStore as DiscordModules.Flux.Store<{
        getUser(userId: string): BasicUser
    }>

    /**
     * <View> (Parent is Stack?)
     *   <Ellipsis />
     *   <Text>
     *     <Text>User</Text>
     *     {' '}and
     *     <Text>Other user</Text>
     *     {' '}are typing...
     *   </Text>
     * </View>
     */
    const viewNode = findInReactFiber(
        tree,
        (
            node,
        ): node is ReactElement<ComponentProps<typeof View>> & {
            props: { children: ReactNode[] }
        } =>
            node.type === View &&
            node.props?.children?.find?.(
                (subnode: ReactNode) =>
                    (subnode as ReactElement)?.type === Design.Text,
            ),
    )

    if (!viewNode) return tree

    const textNode = viewNode.props.children![1] as ReactElement<
        ComponentProps<DiscordModules.Components.Text>
    > & { props: { children: ReactNode[] } }

    function StyledText({ children }: { children: ReactNode }) {
        return (
            <Design.Text {...textNode.props} style={undefined}>
                {children}
            </Design.Text>
        )
    }

    function renderTypingItems(children: ReactNode[]) {
        let userIndex = 0

        return children.map(node_ => {
            const node = node_ as ReactElement<{
                children?: ReactNode
            }>

            if (typeof node !== 'object') {
                return <StyledText>{node}</StyledText>
            }

            const uid = typingUserIds[userIndex]
            if (!uid) return <StyledText key={uid}>{node}</StyledText>

            userIndex++

            const user = UserStore.getUser(uid)
            const avatar = user.getAvatarURL(
                storage.cache!.avatar === DataSource.Guild
                    ? guildId
                    : undefined,
                16,
            )

            node.props.children = getName(user, guildId, storage.cache!.name)

            return (
                <Pressable
                    key={uid}
                    onPress={() => {
                        openUserProfile(uid, channelId)
                    }}
                >
                    <View style={styles.container}>
                        {Boolean(storage.cache!.avatar) && (
                            <Image
                                source={
                                    typeof avatar === 'string'
                                        ? { uri: avatar }
                                        : avatar
                                }
                                style={styles.avatar}
                            />
                        )}
                        {Boolean(storage.cache!.name) && (
                            <StyledText>{node}</StyledText>
                        )}
                    </View>
                </Pressable>
            )
        })
    }

    const children = viewNode.props.children as ReactElement[]
    // If it is a Text node, we can assume the children are the typing items.
    const maybeTextNode = children[1] as
        | ReactElement<{
              children?: ReactNode
          }>
        | undefined

    children[1] = (
        <View style={[styles.container, styles.wrap]}>
            {Array.isArray(children) &&
            maybeTextNode?.type === Design.Text &&
            Array.isArray(maybeTextNode.props.children)
                ? renderTypingItems(maybeTextNode.props.children)
                : children}
        </View>
    )

    return tree
}

function openUserProfile(uid: string, channelId?: string) {
    // modules/user_profile/native/showUserProfileActionSheet.tsx
    const [showUserProfileActionSheet] = lookupModule(
        withName<
            (opts: {
                ignoreBlockedSpeedBump?: boolean
                userId: string
                channelId?: string
            }) => void
        >('showUserProfileActionSheet').and(
            withDependencies([
                withName('_asyncToGenerator'),
                null,
                null,
                withProps('users'),
                withName('asyncRequire'),
                null,
                null,
                null,
                null,
                2,
            ]),
        ),
    )

    showUserProfileActionSheet?.({
        userId: uid,
        channelId,
    })
}

function getName(user: BasicUser, guildId?: string, source?: DataSource) {
    const GuildMemberStore =
        Stores.GuildMemberStore as DiscordModules.Flux.Store<{
            getNick(guildId: string, userId: string): string | null
        }>

    const RelationshipStore =
        Stores.RelationshipStore as DiscordModules.Flux.Store<{
            getNickname(userId: string): string | null
        }>

    switch (source) {
        case DataSource.Username:
            return user.username

        // biome-ignore lint/suspicious/noFallthroughSwitchClause: Intentional fallback
        case DataSource.Guild: {
            const nick = GuildMemberStore.getNick(guildId!, user.id)
            if (nick) return nick
        }

        case DataSource.Global: {
            return (
                RelationshipStore.getNickname(user.id) ||
                user.globalName ||
                user.username
            )
        }
    }
}

interface RenderTypingIndicatorProps {
    channel: BasicChannel
    typingUserIds: string[]
    transitionState: number
    cleanUp: () => void
}

interface BasicChannel {
    id: string
    guild_id: string | undefined
}

interface TypingIndicatorTreeProps {
    item:
        | {
              channel: BasicChannel
              typingUserIds: string[]
          }
        | undefined
    renderItem(
        key: string,
        props: RenderTypingIndicatorProps,
        // state?
        _: number,
        // cleanup?
        __: () => void,
    ): unknown
}

interface BasicUser {
    id: string
    username: string
    globalName: string | null
    getAvatarURL: (guildId?: string, size?: number) => string | AssetId
}

type ThreadChannelComponent = FC<{
    channel: BasicChannel
}>
