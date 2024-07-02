import { zodResolver } from '@hookform/resolvers/zod'
import { PermissionAction } from '@supabase/shared-types/out/constants'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ButtonTooltip } from 'components/ui/ButtonTooltip'
import { useCheckPermissions } from 'hooks'
import { FormControl_Shadcn_, FormField_Shadcn_, FormItem_Shadcn_, Form_Shadcn_, Modal } from 'ui'
import { Input } from '@ui/components/shadcn/ui/input'

type CreateWarehouseProps = {
  onSubmit: (values: { description: string }) => void
  loading: boolean
  open: boolean
  setOpen: (open: boolean) => void
}

const CreateWarehouseAccessToken = ({ onSubmit, loading, open, setOpen }: CreateWarehouseProps) => {
  const FormSchema = z.object({
    description: z.string().min(1, {
      message: 'Description is required',
    }),
  })

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      description: '',
    },
  })

  const canCreateAccessTokens = useCheckPermissions(PermissionAction.ANALYTICS_READ, 'logflare')

  return (
    <>
      <ButtonTooltip
        disabled={!canCreateAccessTokens}
        type="outline"
        onClick={() => setOpen(true)}
        tooltip={{
          content: {
            side: 'bottom',
            text: 'You need additional permissions to create access tokens',
          },
        }}
      >
        Create access token
      </ButtonTooltip>
      <Modal
        size="medium"
        onCancel={() => {
          setOpen(false)
        }}
        header="Create access token"
        visible={open}
        alignFooter="right"
        loading={loading}
        onConfirm={() => {
          form.handleSubmit((data) => {
            onSubmit(data)
          })()
        }}
      >
        <Form_Shadcn_ {...form}>
          <form id="create-access-token-form">
            <Modal.Content className="py-4">
              <p className="pb-5 text-foreground-light text-sm">
                Enter a unique description to identify this token.
              </p>
              <FormField_Shadcn_
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem_Shadcn_>
                    <FormControl_Shadcn_>
                      <Input placeholder="Token" type="text" {...field} />
                    </FormControl_Shadcn_>
                  </FormItem_Shadcn_>
                )}
              />
            </Modal.Content>
          </form>
        </Form_Shadcn_>
      </Modal>
    </>
  )
}

export default CreateWarehouseAccessToken
