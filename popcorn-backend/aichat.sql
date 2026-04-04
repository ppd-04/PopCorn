-- chat history and cache rakha jaate recommendation e sad happy kichu bolleo or mone thake
create table if not exists user_chat_messages (
    id serial primary key,
    user_id integer not null references users(user_id) on delete cascade,
    role varchar(20) not null, -- user na model patahise sheta track kora
    content text not null,
    created_at timestamp with time zone default current_timestamp
);

create table if not exists user_ai_cache (
    user_id integer primary key references users(user_id) on delete cascade,
    recommendations jsonb not null,
    last_updated timestamp with time zone default current_timestamp
);

-- timeline e jeno fast hoy tai index banailam
create index if not exists idx_chat_user_time on user_chat_messages(user_id, created_at desc);
