import { createContext, use, useId } from "react"
import type {
  ControllerProps,
  FieldPath,
  FieldValues,
} from "react-hook-form"
import type { HTMLAttributes, LabelHTMLAttributes, Ref } from "react"
import {
  Controller,
  FormProvider,
  useFormContext,
} from "react-hook-form"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const Form = FormProvider

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  name: TName
}

const FormFieldContext = createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
)

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  ...props
}: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext>
  )
}

function useFormField() {
  const fieldContext = use(FormFieldContext)
  const itemContext = use(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  const fieldState = getFieldState(fieldContext.name, formState)
  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

interface FormItemContextValue {
  id: string
}

const FormItemContext = createContext<FormItemContextValue>(
  {} as FormItemContextValue
)

function FormItem({
  className,
  ref,
  ...props
}: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> }) {
  const id = useId()

  return (
    <FormItemContext value={{ id }}>
      <div ref={ref} className={cn("space-y-2", className)} {...props} />
    </FormItemContext>
  )
}

function FormLabel({
  className,
  ref,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { ref?: Ref<HTMLLabelElement> }) {
  const { error, formItemId } = useFormField()

  return (
    <Label
      ref={ref}
      className={cn(error && "text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  )
}

function FormControl({
  ref,
  ...props
}: HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> }) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  return (
    <div
      ref={ref}
      id={formItemId}
      aria-describedby={
        !error
          ? formDescriptionId
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  )
}

function FormDescription({
  className,
  ref,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { ref?: Ref<HTMLParagraphElement> }) {
  const { formDescriptionId } = useFormField()

  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function FormMessage({
  className,
  children,
  ref,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { ref?: Ref<HTMLParagraphElement> }) {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error.message) : children

  if (!body) {
    return null
  }

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn("text-xs font-medium text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  )
}

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
}
