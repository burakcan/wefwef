import {
  IonActionSheet,
  IonIcon,
  useIonModal,
  useIonRouter,
  useIonToast,
} from "@ionic/react";
import {
  arrowDownOutline,
  arrowUndoOutline,
  arrowUpOutline,
  bookmarkOutline,
  chevronCollapseOutline,
  ellipsisHorizontal,
  flagOutline,
  pencilOutline,
  personOutline,
  shareOutline,
  textOutline,
  trashOutline,
} from "ionicons/icons";
import { CommentView } from "lemmy-js-client";
import { useContext, useState } from "react";
import { useBuildGeneralBrowseLink } from "../../helpers/routes";
import { useAppDispatch, useAppSelector } from "../../store";
import { handleSelector } from "../auth/authSlice";
import {
  getHandle,
  getRemoteHandle,
  canModify as isCommentMutable,
} from "../../helpers/lemmy";
import { deleteComment, saveComment, voteOnComment } from "./commentSlice";
import styled from "@emotion/styled";
import { notEmpty } from "../../helpers/array";
import useCollapseRootComment from "./useCollapseRootComment";
import { FeedContext } from "../feed/FeedContext";
import SelectText from "../../pages/shared/SelectTextModal";
import { PageContext } from "../auth/PageContext";
import { saveError, voteError } from "../../helpers/toastMessages";

const StyledIonIcon = styled(IonIcon)`
  padding: 8px 12px;
  margin: -8px -12px;

  font-size: 1.2em;
`;

interface MoreActionsProps {
  comment: CommentView;
  rootIndex: number | undefined;
}

export default function MoreActions({ comment, rootIndex }: MoreActionsProps) {
  const buildGeneralBrowseLink = useBuildGeneralBrowseLink();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const { prependComments } = useContext(FeedContext);
  const myHandle = useAppSelector(handleSelector);
  const [present] = useIonToast();
  const collapseRootComment = useCollapseRootComment(comment, rootIndex);

  const router = useIonRouter();

  const {
    page,
    presentLoginIfNeeded,
    presentCommentReply,
    presentCommentEdit,
    presentReport,
  } = useContext(PageContext);

  const [selectText, onDismissSelectText] = useIonModal(SelectText, {
    text: comment.comment.content,
    onDismiss: (data: string, role: string) => onDismissSelectText(data, role),
  });

  const commentVotesById = useAppSelector(
    (state) => state.comment.commentVotesById
  );
  const commentSavedById = useAppSelector(
    (state) => state.comment.commentSavedById
  );

  const myVote = commentVotesById[comment.comment.id] ?? comment.my_vote;
  const mySaved = commentSavedById[comment.comment.id] ?? comment.saved;

  const isMyComment = getRemoteHandle(comment.creator) === myHandle;

  return (
    <>
      <StyledIonIcon
        icon={ellipsisHorizontal}
        onClick={(e) => {
          setOpen(true);
          e.stopPropagation();
        }}
      />

      <IonActionSheet
        cssClass="left-align-buttons"
        onClick={(e) => e.stopPropagation()}
        isOpen={open}
        buttons={[
          {
            text: myVote !== 1 ? "Upvote" : "Undo Upvote",
            role: "upvote",
            icon: arrowUpOutline,
          },
          {
            text: myVote !== -1 ? "Downvote" : "Undo Downvote",
            role: "downvote",
            icon: arrowDownOutline,
          },
          {
            text: !mySaved ? "Save" : "Unsave",
            role: "save",
            icon: bookmarkOutline,
          },
          isMyComment && isCommentMutable(comment)
            ? {
                text: "Edit",
                role: "edit",
                icon: pencilOutline,
              }
            : undefined,
          isMyComment && isCommentMutable(comment)
            ? {
                text: "Delete",
                role: "delete",
                icon: trashOutline,
              }
            : undefined,
          {
            text: "Reply",
            role: "reply",
            icon: arrowUndoOutline,
          },
          {
            text: "Select Text",
            role: "select-text",
            icon: textOutline,
          },
          {
            text: getHandle(comment.creator),
            role: "person",
            icon: personOutline,
          },
          {
            text: "Share",
            role: "share",
            icon: shareOutline,
          },
          rootIndex !== undefined
            ? {
                text: "Collapse to Top",
                role: "collapse",
                icon: chevronCollapseOutline,
              }
            : undefined,
          {
            text: "Report",
            role: "report",
            icon: flagOutline,
          },
          {
            text: "Cancel",
            role: "cancel",
          },
        ].filter(notEmpty)}
        onDidDismiss={() => setOpen(false)}
        onWillDismiss={async (e) => {
          switch (e.detail.role) {
            case "upvote":
              if (presentLoginIfNeeded()) return;

              try {
                await dispatch(
                  voteOnComment(comment.comment.id, myVote === 1 ? 0 : 1)
                );
              } catch (error) {
                present(voteError);
              }

              break;
            case "downvote":
              if (presentLoginIfNeeded()) return;

              try {
                await dispatch(
                  voteOnComment(comment.comment.id, myVote === -1 ? 0 : -1)
                );
              } catch (error) {
                present(voteError);
              }

              break;
            case "save":
              if (presentLoginIfNeeded()) return;

              try {
                await dispatch(saveComment(comment.comment.id, !mySaved));
              } catch (error) {
                present(saveError);
              }
              break;
            case "edit":
              presentCommentEdit(comment);
              break;
            case "delete":
              try {
                await dispatch(deleteComment(comment.comment.id));
              } catch (error) {
                present({
                  message: "Problem deleting comment. Please try again.",
                  duration: 3500,
                  position: "bottom",
                  color: "danger",
                });

                throw error;
              }

              present({
                message: "Comment deleted!",
                duration: 3500,
                position: "bottom",
                color: "primary",
              });
              break;
            case "reply": {
              if (presentLoginIfNeeded()) return;

              const reply = await presentCommentReply(comment);

              if (reply) prependComments([reply]);
              break;
            }
            case "select-text":
              return selectText({
                presentingElement: page,
              });
            case "person":
              router.push(
                buildGeneralBrowseLink(`/u/${getHandle(comment.creator)}`)
              );
              break;
            case "share":
              navigator.share({ url: comment.comment.ap_id });
              break;
            case "collapse":
              collapseRootComment();
              break;
            case "report":
              presentReport(comment);
              break;
          }
        }}
      />
    </>
  );
}
