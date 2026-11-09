import { CheckboxButton } from "@repo/ui/checkbox";
import { Form, Formik, FormikHelpers } from "formik";
import { useTranslations } from "next-intl";
import React, { useCallback, useEffect, useState } from "react";
import { useMediaQuery } from "react-responsive";
import * as Yup from "yup";

import DialogHeader from "@/components/atoms/DialogHeader";
import DrawerDialog from "@/components/atoms/DrawerDialog";
import { InputSize } from "@/components/atoms/Input";
import Svg from "@/components/atoms/Svg";
import TextAreaField from "@/components/atoms/TextAreaField";
import TextField, { InputLabel } from "@/components/atoms/TextField";
import Button from "@/components/buttons/Button";
import {
  FeedbackTag,
  useFeedbackDialogStore,
} from "@/components/dialogs/stores/useFeedbackDialogStore";
import { linkTargetProps } from "@/functions/linkTarget";
import addToast from "@/other/toast";

type FeedbackTagTranslationTag =
  | "category_comment"
  | "category_feature"
  | "category_feature_mobile"
  | "category_bug"
  | "category_other";

const feedbackTagLabelsMap: Record<FeedbackTag, FeedbackTagTranslationTag> = {
  [FeedbackTag.COMMENT]: "category_comment",
  [FeedbackTag.BUG]: "category_bug",
  [FeedbackTag.FEATURE_REQUEST]: "category_feature",
  [FeedbackTag.OTHER]: "category_other",
};

const feedbackTagLabelsMapMobile: Record<FeedbackTag, FeedbackTagTranslationTag> = {
  [FeedbackTag.COMMENT]: "category_comment",
  [FeedbackTag.BUG]: "category_bug",
  [FeedbackTag.FEATURE_REQUEST]: "category_feature_mobile",
  [FeedbackTag.OTHER]: "category_other",
};

interface Values {
  email: string;
  description: string;
  tags: FeedbackTag[];
}

const FeedbackSchema = Yup.object().shape({
  email: Yup.string(),
  description: Yup.string()
    .required("This field is required")
    .min(3, "Must be at least 3 characters")
    .max(20000, "Max number of characters 20000"),
  tags: Yup.array().of(Yup.string()),
});

function SuccessFeedback() {
  const t = useTranslations("Feedback");

  return (
    <div className="card-spacing w-full md:w-[600px]">
      <div className="mx-auto w-[80px] h-[80px] flex items-center justify-center relative mb-5">
        <div className="w-[54px] h-[54px] rounded-full border-[7px] blur-[8px] opacity-80 border-green"></div>
        <Svg
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-green"
          iconName="success"
          size={65}
        />
      </div>
      <h3 className="text-20 font-bold mb-2 text-center">{t("sent_successfully")}</h3>
      <h3 className="text-secondary-text text-center">
        {t.rich("thank_you_for_the_feedback", {
          telegram: (chunks) => (
            <a
              {...linkTargetProps("https://t.me/Dex223_defi")}
              href="https://t.me/Dex223_defi"
              className="text-green hocus:underline inline-flex items-center"
            >
              {chunks}
              <Svg iconName="forward" size={16} aria-hidden="true" />
            </a>
          ),
          discord: (chunks) => (
            <a
              {...linkTargetProps("https://discord.gg/t5bdeGC5Jk")}
              href="https://discord.gg/t5bdeGC5Jk"
              className="text-green hocus:underline inline-flex items-center"
            >
              {chunks}
              <Svg iconName="forward" size={16} aria-hidden="true" />
            </a>
          ),
        })}
      </h3>
    </div>
  );
}
export default function FeedbackDialog() {
  const t = useTranslations("Feedback");

  const {
    isOpen,
    setIsOpen,
    tags,
    description,
    setDescription,
    addTag,
    removeTag,
    email,
    setEmail,
    clearDraft,
  } = useFeedbackDialogStore();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  useEffect(() => {
    if (isSubmitted && !isOpen) {
      setTimeout(() => {
        setIsSubmitted(false);
      }, 400);
    }
  }, [isOpen, isSubmitted]);

  const initialValues: Values = {
    email: email,
    description: description,
    tags: tags,
  };

  const isMobile = useMediaQuery({ query: "(max-width: 767px)" });

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{ transform: "rotate(-90deg) translateX(50%)" }}
        className="hidden xl:flex px-5 h-10 origin-bottom-right fixed right-0 bottom-1/2 bg-green hocus:bg-green-hover duration-200 rounded-t-2 shadow shadow-green/60 text-secondary-bg items-center gap-2"
      >
        {t("feedback")}
        <Svg iconName="star" />
      </button>
      <DrawerDialog isOpen={isOpen} setIsOpen={handleClose}>
        <DialogHeader onClose={handleClose} title={t("feedback")} />

        {isSubmitted ? (
          <SuccessFeedback />
        ) : (
          <div className="w-full md:w-[600px] card-spacing">
            <p className="text-secondary-text text-16 mb-5">
              {t.rich("feel_free_to_share", {
                github: (chunks) => (
                  <a
                    {...linkTargetProps("https://github.com/EthereumCommonwealth/Dex223-UI/issues")}
                    href="https://github.com/EthereumCommonwealth/Dex223-UI/issues"
                    className="text-green underline hocus:text-green-hover duration-200 inline-flex items-center"
                  >
                    {chunks}
                    <Svg iconName="forward" size={16} aria-hidden="true" />
                  </a>
                ),
              })}
            </p>
            <Formik
              initialValues={initialValues}
              validationSchema={FeedbackSchema}
              onSubmit={async (
                values: Values,
                { setSubmitting, resetForm }: FormikHelpers<Values>,
              ) => {
                setSubmitting(true);
                try {
                  const data = await fetch("https://api.dex223.io/v1/core/api/feedback", {
                    method: "POST",
                    body: JSON.stringify({
                      message: values.description,
                      contact: values.email,
                      categories: values.tags,
                    }),
                    headers: {
                      Accept: "application/json",
                      "Content-Type": "application/json",
                    },
                  });
                  if (data.ok) {
                    setIsSubmitted(true);
                    addToast(t("sent_successfully"));
                    setSubmitting(false);
                    resetForm();
                    clearDraft();
                  } else {
                    addToast(t("something_went_wrong"), "error");
                  }
                } catch (e) {
                  console.log(e);
                  addToast(t("something_went_wrong"), "error");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {({
                submitForm,
                isSubmitting,
                handleChange,
                handleBlur,
                values,
                errors,
                touched,
                setFieldValue,
              }) => {
                return (
                  <Form>
                    <TextAreaField
                      id="description"
                      name="description"
                      onChange={(e) => {
                        handleChange(e);
                        setDescription(e.target.value);
                      }}
                      onBlur={handleBlur}
                      label={`${t("describe_your_issue")} *`}
                      rows={4}
                      placeholder={t("describe_your_issue")}
                      value={values.description}
                      error={touched.description && errors.description ? errors.description : ""}
                    />

                    <div className="h-2" />

                    <TextField
                      id="email"
                      name="email"
                      placeholder={t("email_wallet_address_or_nickname")}
                      label={t("email_wallet_address_or_nickname")}
                      onChange={(e) => {
                        handleChange(e);
                        setEmail(e.target.value);
                      }}
                      onBlur={handleBlur}
                      value={values.email}
                      maxLength={255}
                    />

                    <InputLabel label="Feedback category" inputSize={InputSize.LARGE} />
                    <div className="grid gap-2 grid-cols-2 mb-5">
                      {[
                        FeedbackTag.COMMENT,
                        FeedbackTag.BUG,
                        FeedbackTag.FEATURE_REQUEST,
                        FeedbackTag.OTHER,
                      ].map((feedbackTag) => {
                        return (
                          <CheckboxButton
                            key={feedbackTag}
                            checked={values.tags.includes(feedbackTag)}
                            handleChange={async () => {
                              if (values.tags.includes(feedbackTag)) {
                                removeTag(feedbackTag);
                                await setFieldValue(
                                  "tags",
                                  values.tags.filter((v) => v !== feedbackTag),
                                  false,
                                );
                              } else {
                                addTag(feedbackTag);
                                await setFieldValue("tags", [...values.tags, feedbackTag], false);
                              }
                            }}
                            id={feedbackTag + "_feedback_tag"}
                            label={
                              isMobile
                                ? t(feedbackTagLabelsMapMobile[feedbackTag])
                                : t(feedbackTagLabelsMap[feedbackTag])
                            }
                          />
                        );
                      })}
                    </div>
                    <Button
                      type="submit"
                      disabled={Boolean(errors.description && touched.description) || isSubmitting}
                      fullWidth
                      onClick={submitForm}
                    >
                      {isSubmitting ? t("submitting") : t("send_feedback")}
                    </Button>
                  </Form>
                );
              }}
            </Formik>
          </div>
        )}
      </DrawerDialog>
    </>
  );
}
