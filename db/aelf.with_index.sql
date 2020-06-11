/*
 Navicat MySQL Data Transfer

 Source Server         : hzz780
 Source Server Type    : MySQL
 Source Server Version : 100406
 Source Host           : localhost:3306
 Source Schema         : aelf_main_chain

 Target Server Type    : MySQL
 Target Server Version : 100406
 File Encoding         : 65001

 Date: 21/08/2019 16:03:56
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET CHARSET utf8mb4;

-- ----------------------------
-- Table structure for address_contracts
-- ----------------------------
DROP TABLE IF EXISTS `address_contracts`;
CREATE TABLE `address_contracts`
(
    `id`               bigint unsigned NOT NULL AUTO_INCREMENT,
    `address`          varchar(64)     NOT NULL,
    `contract_address` varchar(64)     NOT NULL,
    `symbol`           varchar(64)     NOT NULL,
    `update_time`      datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE KEY (`address`, `contract_address`, `symbol`) USING BTREE
) ENGINE = InnoDB;

-- ----------------------------
-- Table structure for blocks_0
-- ----------------------------
DROP TABLE IF EXISTS `blocks_0`;
CREATE TABLE `blocks_0`
(
    `id`                bigint unsigned NOT NULL AUTO_INCREMENT,
    `block_hash`        varchar(64)     NOT NULL,
    `pre_block_hash`    varchar(64)     NOT NULL,
    `chain_id`          varchar(64)     NOT NULL,
    `dividends`         varchar(255)    NOT NULL DEFAULT '{}',
    `miner`             varchar(64)     NOT NULL,
    `tx_fee`         varchar(255)    NOT NULL DEFAULT '{}',
    `resources`         varchar(255)    NOT NULL DEFAULT '{}',
    `block_height`      BIGINT          NOT NULL,
    `tx_count`          int             NOT NULL,
    `merkle_root_tx`    varchar(64)     NOT NULL,
    `merkle_root_state` varchar(64)     NOT NULL,
    `time`              varchar(64)     NOT NULL COMMENT '直接转存节点来的',
    PRIMARY KEY (`id`) USING BTREE,
    KEY `hash` (`block_hash`) USING BTREE,
    KEY `block_height` (`block_height`) USING BTREE,
    KEY `time` (`time`)
) ENGINE = InnoDB
  AUTO_INCREMENT = 1
  PARTITION BY RANGE COLUMNS (`id`) (
    PARTITION p0_1 VALUES LESS THAN (10000001),
    PARTITION p1_2 VALUES LESS THAN (20000001),
    PARTITION p2_3 VALUES LESS THAN (30000001),
    PARTITION p3_4 VALUES LESS THAN (40000001),
    PARTITION p4_5 VALUES LESS THAN (50000001),
    PARTITION p5_6 VALUES LESS THAN (60000001),
    PARTITION p60 VALUES LESS THAN MAXVALUE
    );

-- ----------------------------
-- Table structure for blocks_unconfirmed
-- ----------------------------
DROP TABLE IF EXISTS `blocks_unconfirmed`;
CREATE TABLE `blocks_unconfirmed`
(
    `id`                bigint unsigned NOT NULL AUTO_INCREMENT,
    `block_hash`        varchar(64)     NOT NULL,
    `pre_block_hash`    varchar(64)     NOT NULL,
    `chain_id`          varchar(64)     NOT NULL,
    `dividends`         varchar(255)    NOT NULL DEFAULT '{}',
    `miner`             varchar(64)     NOT NULL,
    `tx_fee`         varchar(255)    NOT NULL DEFAULT '{}',
    `resources`         varchar(255)    NOT NULL DEFAULT '{}',
    `block_height`      BIGINT          NOT NULL,
    `tx_count`          int             NOT NULL,
    `merkle_root_tx`    varchar(64)     NOT NULL,
    `merkle_root_state` varchar(64)     NOT NULL,
    `time`              varchar(64)     NOT NULL COMMENT '直接转存节点来的',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE KEY `block_hash` (`block_hash`) USING BTREE,
    UNIQUE KEY `block_height` (`block_height`) USING BTREE,
    KEY `time` (`time`)
) ENGINE = InnoDB;

-- ----------------------------
-- Table structure for contract_aelf20
-- ----------------------------
DROP TABLE IF EXISTS `contract_aelf20`;
CREATE TABLE `contract_aelf20`
(
    `id`               bigint unsigned NOT NULL AUTO_INCREMENT,
    `contract_address` varchar(64)     NOT NULL,
    `symbol`           varchar(64)     NOT NULL,
    `chain_id`         varchar(64)     NOT NULL,
    `tx_id`            varchar(64)     NOT NULL,
    `name`             varchar(64)     NOT NULL,
    `total_supply`     bigint unsigned NOT NULL,
    `supply`           bigint unsigned NOT NULL,
    `decimals`         int DEFAULT 8,
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE KEY `address_symbol` (`contract_address`, `symbol`) USING BTREE
) ENGINE = InnoDB
  AUTO_INCREMENT = 1;

-- ----------------------------
-- Table structure for nodes_0
-- ----------------------------
DROP TABLE IF EXISTS `nodes_0`;
CREATE TABLE `nodes_0`
(
    `id`               bigint unsigned NOT NULL AUTO_INCREMENT,
    `contract_address` varchar(64)     NOT NULL COMMENT 'token contract address',
    `chain_id`         varchar(64)     NOT NULL,
    `api_ip`           varchar(128)    NOT NULL,
    `api_domain`       varchar(255)    NOT NULL,
    `rpc_ip`           varchar(128)    NOT NULL,
    `rpc_domain`       varchar(255)    NOT NULL,
    `token_name`       varchar(255)    NOT NULL,
    `owner`            varchar(255)    NOT NULL,
    `status`           int(1)          NOT NULL,
    `create_time`      timestamp       NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE KEY `address_chain_id` (`contract_address`, `chain_id`) USING BTREE
) ENGINE = InnoDB;

-- ----------------------------
-- Table structure for resource_0
-- ----------------------------
DROP TABLE IF EXISTS `resource_0`;
CREATE TABLE `resource_0`
(
    `id`           bigint unsigned NOT NULL AUTO_INCREMENT,
    `tx_id`        varchar(64)     NOT NULL,
    `address`      varchar(64)     NOT NULL,
    `method`       varchar(64)     NOT NULL,
    `type`         varchar(8)      NOT NULL COMMENT 'resource type',
    `resource`     BIGINT          NOT NULL COMMENT 'quantity of resource',
    `elf`          BIGINT          NOT NULL COMMENT 'quantity of resource',
    `fee`          BIGINT          NOT NULL COMMENT 'quantity of resource',
    `chain_id`     varchar(64)     NOT NULL,
    `block_height` BIGINT          NOT NULL,
    `tx_status`    varchar(64)     NOT NULL,
    `time`         varchar(64)     NOT NULL,
    PRIMARY KEY (`id`) USING BTREE,
    KEY `tx_id` (`tx_id`) USING BTREE
) ENGINE = InnoDB
    PARTITION BY RANGE COLUMNS (`id`) (
        PARTITION p0_1 VALUES LESS THAN (10000001),
        PARTITION p1_2 VALUES LESS THAN (20000001),
        PARTITION p2_3 VALUES LESS THAN (30000001),
        PARTITION p3_4 VALUES LESS THAN (40000001),
        PARTITION p4_5 VALUES LESS THAN (50000001),
        PARTITION p5_6 VALUES LESS THAN (60000001),
        PARTITION p6_7 VALUES LESS THAN (70000001),
        PARTITION p7_8 VALUES LESS THAN (80000001),
        PARTITION p8_9 VALUES LESS THAN (90000001),
        PARTITION p9_10 VALUES LESS THAN (100000001),
        PARTITION p10 VALUES LESS THAN MAXVALUE
        );

-- ----------------------------
-- Table structure for resource_unconfirmed
-- ----------------------------
DROP TABLE IF EXISTS `resource_unconfirmed`;
CREATE TABLE `resource_unconfirmed`
(
    `id`           bigint unsigned NOT NULL AUTO_INCREMENT,
    `tx_id`        varchar(64)     NOT NULL,
    `address`      varchar(64)     NOT NULL,
    `method`       varchar(64)     NOT NULL,
    `type`         varchar(8)      NOT NULL COMMENT 'resource type',
    `resource`     bigint          NOT NULL COMMENT 'quantity of resource',
    `elf`          BIGINT          NOT NULL COMMENT 'quantity of resource',
    `fee`          BIGINT          NOT NULL COMMENT 'quantity of resource',
    `chain_id`     varchar(64)     NOT NULL,
    `block_height` BIGINT          NOT NULL,
    `tx_status`    varchar(64)     NOT NULL,
    `time`         varchar(64)     NOT NULL,
    PRIMARY KEY (`id`) USING BTREE,
    KEY `tx_id` (`tx_id`) USING BTREE
) ENGINE = InnoDB;

-- ----------------------------
-- Table structure for tps_0
-- ----------------------------
DROP TABLE IF EXISTS `tps_0`;
CREATE TABLE `tps_0`
(
    `id`     bigint unsigned NOT NULL AUTO_INCREMENT,
    `start`  varchar(64)     NOT NULL COMMENT 'start time, from blocks_0',
    `end`    varchar(64)     NOT NULL COMMENT 'start + N(the value of key: type)',
    `txs`    int             NOT NULL COMMENT 'tx count during N minutes',
    `blocks` int             NOT NULL COMMENT 'block count during N minutes',
    `tps`    int             NOT NULL COMMENT 'transactions per second',
    `tpm`    int             NOT NULL COMMENT 'transactions per minute',
    `type`   int             NOT NULL COMMENT 'N, interval time',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE KEY `start` (`start`) USING BTREE,
    UNIQUE KEY `end` (`end`) USING BTREE
) ENGINE = InnoDB;

-- ----------------------------
-- Table structure for transactions_0
-- ----------------------------
DROP TABLE IF EXISTS `transactions_0`;
CREATE TABLE `transactions_0`
(
    `id`           bigint unsigned NOT NULL AUTO_INCREMENT,
    `tx_id`        varchar(64)     NOT NULL,
    `params_to`    varchar(64)     NOT NULL DEFAULT '-1' COMMENT 'target address',
    `chain_id`     varchar(64)     NOT NULL,
    `block_height` BIGINT unsigned NOT NULL,
    `address_from` varchar(64)     NOT NULL,
    `address_to`   varchar(64)     NOT NULL COMMENT 'contract address',
    `params`       text            NOT NULL,
    `method`       varchar(64)     NOT NULL,
    `block_hash`   varchar(64)     NOT NULL,
    `tx_fee`       varchar(255)    NOT NULL DEFAULT '{}',
    `resources`    varchar(255)    NOT NULL DEFAULT '{}',
    `quantity`     BIGINT          NOT NULL,
    `tx_status`    varchar(64)     NOT NULL,
    `time`         varchar(64)     NOT NULL COMMENT 'time of blocks',
    PRIMARY KEY (`id`) USING BTREE,
    KEY `tx_id` (`tx_id`),
    KEY `params_to` (`params_to`),
    KEY `block_hash` (`block_hash`),
    KEY `method` (`method`),
    KEY `address_to` (`address_to`),
    KEY `address_from` (`address_from`),
    KEY `block_height` (`block_height`)
) ENGINE = InnoDB
  AUTO_INCREMENT = 1
    PARTITION BY RANGE COLUMNS (id) (
        PARTITION p0_1 VALUES LESS THAN (10000001),
        PARTITION p1_2 VALUES LESS THAN (20000001),
        PARTITION p2_3 VALUES LESS THAN (30000001),
        PARTITION p3_4 VALUES LESS THAN (40000001),
        PARTITION p4_5 VALUES LESS THAN (50000001),
        PARTITION p5_6 VALUES LESS THAN (60000001),
        PARTITION p6_7 VALUES LESS THAN (70000001),
        PARTITION p7_8 VALUES LESS THAN (80000001),
        PARTITION p8_9 VALUES LESS THAN (90000001),
        PARTITION p9_10 VALUES LESS THAN (100000001),
        PARTITION p10 VALUES LESS THAN MAXVALUE
        );

-- ----------------------------
-- Table structure for transactions_unconfirmed
-- ----------------------------
DROP TABLE IF EXISTS `transactions_unconfirmed`;
CREATE TABLE `transactions_unconfirmed`
(
    `id`           bigint unsigned NOT NULL AUTO_INCREMENT,
    `tx_id`        varchar(64)     NOT NULL,
    `params_to`    varchar(64)     NOT NULL DEFAULT '-1' COMMENT 'target address',
    `chain_id`     varchar(64)     NOT NULL,
    `block_height` BIGINT unsigned NOT NULL,
    `address_from` varchar(64)     NOT NULL,
    `address_to`   varchar(64)     NOT NULL COMMENT 'contract address',
    `params`       text            NOT NULL,
    `method`       varchar(64)     NOT NULL,
    `block_hash`   varchar(64)     NOT NULL,
    `tx_fee`       varchar(255)    NOT NULL DEFAULT '{}',
    `resources`    varchar(255)    NOT NULL DEFAULT '{}',
    `quantity`     BIGINT          NOT NULL,
    `tx_status`    varchar(64)     NOT NULL,
    `time`         varchar(64)     NOT NULL COMMENT 'time of blocks',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE KEY `tx_id` (`tx_id`),
    KEY `params_to` (`params_to`),
    KEY `block_hash` (`block_hash`),
    KEY `method` (`method`),
    KEY `address_to` (`address_to`),
    KEY `address_from` (`address_from`),
    KEY `block_height` (`block_height`)
) ENGINE = InnoDB;

-- ----------------------------
-- Table structure for user
-- ----------------------------
DROP TABLE IF EXISTS `user`;
CREATE TABLE `user`
(
    `id`         bigint    NOT NULL,
    `address`    varchar(255) DEFAULT NULL,
    `name`       varchar(255) DEFAULT NULL,
    `avatar_url` varchar(255) DEFAULT NULL,
    `phone`      varchar(255) DEFAULT NULL,
    `password`   varchar(255) DEFAULT NULL,
    `created_at` timestamp NULL                   DEFAULT NULL,
    `updated_at` timestamp NULL                   DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB;

DROP TABLE IF EXISTS `vote_teams`;
CREATE TABLE `vote_teams`
(
    `id`               bigint UNSIGNED NOT NULL AUTO_INCREMENT,
    `public_key`       VARCHAR(255)    NOT NULL,
    `address`          VARCHAR(64)     NOT NULL,
    `name`             VARCHAR(64)     NOT NULL,
    `avatar`           TEXT         DEFAULT NULL,
    `intro`            TEXT         DEFAULT NULL,
    `tx_id`            VARCHAR(64)  DEFAULT NULL,
    `is_active`        BOOLEAN      DEFAULT FALSE,
    `socials`          JSON,
    `official_website` TEXT         DEFAULT NULL,
    `location`         TEXT         DEFAULT NULL,
    `mail`             VARCHAR(255) DEFAULT NULL,
    `update_time`      DATETIME     DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (`id`),
    KEY `public_key` (`public_key`) USING BTREE,
    KEY `address` (`address`) USING BTREE,
    KEY `name` (`name`),
    UNIQUE KEY `key_time` (`public_key`, `update_time`) USING BTREE
) ENGINE = InnoDB
  auto_increment = 1;

-- ----------------------------
-- Table structure for token related transactions
-- ----------------------------
DROP TABLE IF EXISTS `transactions_token`;
CREATE TABLE `transactions_token`
(
    `id`           bigint unsigned NOT NULL AUTO_INCREMENT,
    `tx_id`        varchar(64)     NOT NULL,
    `chain_id`     varchar(64)     NOT NULL,
    `block_height` BIGINT unsigned NOT NULL,
    `symbol`       varchar(64)     NOT NULL,
    `address_from` varchar(64)     NOT NULL,
    `address_to`   varchar(64)     NOT NULL COMMENT 'contract address',
    `params`       TEXT            NOT NULL,
    `method`       varchar(64)     NOT NULL,
    `block_hash`   varchar(64)     NOT NULL,
    `tx_status`    varchar(64)     NOT NULL,
    `time`         varchar(64)     NOT NULL COMMENT 'time of blocks',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE KEY `tx_id` (`tx_id`),
    KEY `block_hash` (`block_hash`),
    KEY `method` (`method`),
    KEY `address_from` (`address_from`),
    KEY `address_to` (`address_to`),
    KEY `symbol` (`symbol`)
) ENGINE = InnoDB
  AUTO_INCREMENT = 1;

DROP TABLE IF EXISTS `transactions_token_unconfirmed`;
CREATE TABLE `transactions_token_unconfirmed`
(
    `id`           bigint unsigned NOT NULL AUTO_INCREMENT,
    `tx_id`        varchar(64)     NOT NULL,
    `chain_id`     varchar(64)     NOT NULL,
    `block_height` BIGINT unsigned NOT NULL,
    `symbol`       varchar(64)     NOT NULL,
    `address_from` varchar(64)     NOT NULL,
    `address_to`   varchar(64)     NOT NULL COMMENT 'contract address',
    `params`       TEXT            NOT NULL,
    `method`       varchar(64)     NOT NULL,
    `block_hash`   varchar(64)     NOT NULL,
    `tx_status`    varchar(64)     NOT NULL,
    `time`         varchar(64)     NOT NULL COMMENT 'time of blocks',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE KEY `tx_id` (`tx_id`),
    KEY `block_hash` (`block_hash`),
    KEY `method` (`method`),
    KEY `address_from` (`address_from`),
    KEY `address_to` (`address_to`),
    KEY `symbol` (`symbol`)
) ENGINE = InnoDB
  AUTO_INCREMENT = 1;

DROP TABLE IF EXISTS `events`;
CREATE TABLE `events`
(
    `id`      bigint(20) unsigned NOT NULL AUTO_INCREMENT,
    `tx_id`   varchar(64)         NOT NULL,
    `name`    varchar(255)        NOT NULL,
    `address` varchar(64)         NOT NULL,
    `data`    longtext                NOT NULL,
    PRIMARY KEY (`id`),
    KEY `address` (`address`) USING BTREE,
    KEY `name` (`name`) USING BTREE,
    KEY `tx_id` (`tx_id`) USING BTREE
) ENGINE = InnoDB
  AUTO_INCREMENT = 1
    PARTITION BY RANGE COLUMNS (id) (
        PARTITION p0_1 VALUES LESS THAN (10000001),
        PARTITION p1_2 VALUES LESS THAN (20000001),
        PARTITION p2_3 VALUES LESS THAN (30000001),
        PARTITION p3_4 VALUES LESS THAN (40000001),
        PARTITION p4_5 VALUES LESS THAN (50000001),
        PARTITION p5_6 VALUES LESS THAN (60000001),
        PARTITION p6_7 VALUES LESS THAN (70000001),
        PARTITION p7_8 VALUES LESS THAN (80000001),
        PARTITION p8_9 VALUES LESS THAN (90000001),
        PARTITION p9_10 VALUES LESS THAN (100000001),
        PARTITION p10 VALUES LESS THAN MAXVALUE
    );

DROP TABLE IF EXISTS `token_tx`;
CREATE TABLE `token_tx`
(
    `id`     bigint(20) unsigned NOT NULL AUTO_INCREMENT,
    `tx_id`  varchar(64)         NOT NULL,
    `event`  varchar(255)        NOT NULL,
    `symbol` varchar(255)        NOT NULL,
    PRIMARY KEY (`id`),
    KEY `symbol` (`symbol`) USING BTREE,
    KEY `tx_id` (`tx_id`) USING BTREE
) ENGINE = InnoDB
  AUTO_INCREMENT = 1
    PARTITION BY RANGE COLUMNS (id) (
        PARTITION p0_1 VALUES LESS THAN (10000001),
        PARTITION p1_2 VALUES LESS THAN (20000001),
        PARTITION p2_3 VALUES LESS THAN (30000001),
        PARTITION p3_4 VALUES LESS THAN (40000001),
        PARTITION p4_5 VALUES LESS THAN (50000001),
        PARTITION p5_6 VALUES LESS THAN (60000001),
        PARTITION p6_7 VALUES LESS THAN (70000001),
        PARTITION p7_8 VALUES LESS THAN (80000001),
        PARTITION p8_9 VALUES LESS THAN (90000001),
        PARTITION p9_10 VALUES LESS THAN (100000001),
        PARTITION p10 VALUES LESS THAN MAXVALUE
        );

drop table IF EXISTS `balance`;
create TABLE `balance` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `owner` varchar(255) NOT NULL,
  `symbol` varchar(255) NOT NULL DEFAULT 'none',
  `balance` decimal(64,8) NOT NULL DEFAULT '0.00000000',
  `count` bigint(20) NOT NULL DEFAULT '0',
  `updated_at` varchar(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `owner_symbol` (`owner`,`symbol`),
  KEY `owner` (`owner`),
  KEY `symbol` (`symbol`)
) ENGINE=InnoDB AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;
