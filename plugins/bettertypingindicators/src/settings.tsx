import { TableRowAssetIcon } from '@revenge-mod/components'
import Page from '@revenge-mod/components/Page'
import { Design } from '@revenge-mod/discord/design'
import { ScrollView } from 'react-native'
import { ChannelListAppearance, DataSource } from '.'
import type { PluginSettingsComponent } from '@revenge-mod/plugins/types'
import type { ComponentProps } from 'react'
import type { Settings } from '.'

const { Stack, TableRadioGroup, TableRadioRow, TableRowGroup, TableSwitchRow } =
    Design

type Props = ComponentProps<PluginSettingsComponent<{ storage: Settings }>>

export function SettingsComponent({ api }: Props) {
    return (
        <Page>
            <ScrollView>
                <Stack spacing={24}>
                    <AvatarSourceSetting api={api} />
                    <NameSourceSetting api={api} />
                    {/* <ChannelListAppearanceSettings api={api} /> */}
                </Stack>
            </ScrollView>
        </Page>
    )
}

function AvatarSourceSetting({ api }: Props) {
    const setting = api.storage.use(x => x.avatar)!.avatar

    return (
        <TableRadioGroup
            title="Avatars"
            defaultValue={setting}
            onChange={(v: DataSource | false) => {
                api.storage.set({
                    avatar: v,
                })
            }}
        >
            <TableRadioRow label="Don't show avatars" value={false} />
            <TableRadioRow label="Show avatars" value={0} />
            <TableRadioRow label="Prefer server avatars" value={1} />
        </TableRadioGroup>
    )
}

function NameSourceSetting({ api }: Props) {
    const setting = api.storage.use(x => x.name)!.name

    return (
        <TableRadioGroup
            title="Names"
            defaultValue={setting}
            onChange={v => {
                api.storage.set({
                    name: v,
                })
            }}
        >
            <TableRadioRow label="Don't show names" value={false} />
            <TableRadioRow
                label="Prefer usernames"
                value={DataSource.Username}
            />
            <TableRadioRow
                label="Prefer display names"
                value={DataSource.Global}
            />
            <TableRadioRow label="Prefer nicknames" value={DataSource.Guild} />
        </TableRadioGroup>
    )
}

function ChannelListAppearanceSettings({ api }: Props) {
    const setting = api.storage.use(x => x.channel)!.channel

    return (
        <TableRowGroup
            title="Channel List"
            description="Show typing indicators in the channel list."
            hasIcons
        >
            <TableSwitchRow
                icon={<TableRowAssetIcon name="MoreHorizontalIcon" />}
                label="Show ellipsis"
                subLabel="Display the three dots typing indicator."
                value={
                    (setting.appearance & ChannelListAppearance.Ellipsis) !== 0
                }
                onValueChange={(enabled: boolean) => {
                    const newAppearance = enabled
                        ? setting.appearance | 1
                        : setting.appearance & ~1
                    api.storage.set({
                        channel: {
                            appearance: newAppearance,
                        },
                    })
                }}
            />
            <TableSwitchRow
                icon={<TableRowAssetIcon name="UserCircleIcon" />}
                label="Show avatars"
                value={
                    (setting.appearance & ChannelListAppearance.Avatars) !== 0
                }
                onValueChange={(enabled: boolean) => {
                    const newAppearance = enabled
                        ? setting.appearance | 2
                        : setting.appearance & ~2
                    api.storage.set({
                        channel: {
                            appearance: newAppearance,
                        },
                    })
                }}
            />
            <TableSwitchRow
                icon={<TableRowAssetIcon name="BellSlashIcon" />}
                label="Include muted channels"
                subLabel="Show typing indicators for muted channels."
                value={
                    (setting.appearance &
                        ChannelListAppearance.IncludeMuted) !==
                    0
                }
                onValueChange={(enabled: boolean) => {
                    const newAppearance = enabled
                        ? setting.appearance | 4
                        : setting.appearance & ~4
                    api.storage.set({
                        channel: {
                            appearance: newAppearance,
                        },
                    })
                }}
            />
        </TableRowGroup>
    )
}
