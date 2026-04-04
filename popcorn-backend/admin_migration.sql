-- isadmin add korlam admin naki dekhte
alter table users add column if not exists is_admin boolean default false;

-- delete kore dile archive kore rakhbo history rakhte
create table if not exists archived_user_history (
    archive_id serial primary key,
    original_user_id integer,
    username varchar(255),
    email varchar(255),
    content text,
    entity_type varchar(50), -- post or comment kono prokar
    original_created_at timestamp,
    archived_at timestamp default now()
);

-- delete korle archive e rakhar trigger
create or replace function archive_user_data_before_delete()
returns trigger as $$
begin
    -- social post archive e dhukano
    insert into archived_user_history (original_user_id, username, email, content, entity_type, original_created_at)
    select old.user_id, old.username, old.email, content, 'social_post', created_at
    from social_posts where user_id = old.user_id;

    -- social post comment archive e dhukano
    insert into archived_user_history (original_user_id, username, email, content, entity_type, original_created_at)
    select old.user_id, old.username, old.email, content, 'post_comment', created_at
    from post_comments where user_id = old.user_id;

    -- movie comment archive e dhukano
    insert into archived_user_history (original_user_id, username, email, content, entity_type, original_created_at)
    select old.user_id, old.username, old.email, content, 'movie_comment', created_at
    from movie_comments where user_id = old.user_id;

    return old;
end;
$$ language plpgsql;

-- users table e attach korlam
drop trigger if exists trigger_archive_user_data on users;
create trigger trigger_archive_user_data
before delete on users
for each row execute function archive_user_data_before_delete();